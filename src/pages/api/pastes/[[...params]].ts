import {
  Body,
  createHandler,
  Get as GetRoute,
  HttpException,
  NotFoundException,
  Param,
  Post,
  BadRequestException,
  Req,
  UnauthorizedException,
  Query,
  Delete,
  Put,
  UseMiddleware,
} from "@storyofams/next-api-decorators";
import {
  Collection,
  Create,
  Documents,
  Get,
  Index,
  Lambda,
  Map,
  Match,
  Paginate,
  Ref,
  Delete as DeleteDb,
  Update,
} from "faunadb";
import { NextApiRequest } from "next";
import { getSession } from "next-auth/client";
import { NextApiRequestQuery } from "next/dist/server/api-utils";
import { Paste } from "types/Paste";
import { User } from "types/User";
import { client } from "@lib/faunadb";
import { QueryData } from "types/Query";
import { Cors } from "@lib/middlewares";

@UseMiddleware(Cors)
class PastesRouter {
  @GetRoute("/")
  public async getPastes(@Query() query: NextApiRequestQuery) {
    const pastes = await client
      .query<{ data: { data: Paste; ref: any }[] }>(
        Map(
          Paginate(Documents(Collection("pastes")), { size: Number(query.amount) || 30 }),
          Lambda((x) => Get(x)),
        ),
      )
      .catch(console.error);

    if (typeof pastes === "function" || !pastes) {
      throw new HttpException(500, "An error occurred");
    }

    return pastes.data.map((paste) => {
      return {
        ...paste.data,
        id: paste.ref?.id,
      };
    });
  }

  @GetRoute("/:id")
  public async getPasteById(@Param("id") id: string): Promise<Paste> {
    const paste = await client
      .query<QueryData<Paste>>(Get(Ref(Collection("pastes"), id)))
      .catch(() => null);

    if (!paste?.data) {
      throw new NotFoundException("That paste was not found");
    }

    return {
      ...paste.data,
      id: paste.ref.id,
    };
  }

  @Post()
  public async createPaste(@Req() req: NextApiRequest, @Body() body: any) {
    const { title, text, syntax } = body;
    const session = await getSession({ req });

    if (!title || !text) {
      throw new BadRequestException("`title` and `text` are required");
    }

    const user = session?.user?.name
      ? await client
          .query<QueryData<User>>(Get(Match(Index("get_user_by_name"), session.user?.name)))
          .catch(() => null)
      : null;

    if (session && !user?.data) {
      throw new BadRequestException("User was not found");
    }

    const paste = await client
      .query<QueryData<Paste>>(
        Create(Collection("pastes"), {
          data: {
            text,
            title,
            syntax: syntax || "text",
            created_at: Date.now(),
            updated_at: Date.now(),
            created_by: user?.data ?? null,
          },
        }),
      )
      .catch(() => null);

    return {
      paste: {
        id: paste?.ref?.id,
        ...paste?.data,
      },
      status: "success",
    };
  }

  @Put("/:id")
  public async editPaste(@Req() req: NextApiRequest, @Param("id") id: string, @Body() body: any) {
    const paste = await client
      .query<QueryData<Paste>>(Get(Ref(Collection("pastes"), id)))
      .catch(() => null);
    const session = await getSession({ req });

    if (!session) {
      throw new UnauthorizedException("You need to be logged in to continue");
    }

    if (!paste?.data) {
      throw new NotFoundException("That paste was not found");
    }

    if (paste.data.created_by?.name !== session.user?.name) {
      throw new HttpException(403, "This paste is not associated with your account");
    }

    if (!body.text || !body.title) {
      throw new BadRequestException("`title` and `text` are required");
    }

    await client.query(
      Update(Ref(Collection("pastes"), id), {
        data: {
          syntax: body.syntax || "text",
          text: body.text,
          title: body.title,
        },
      }),
    );

    return {
      status: "success",
    };
  }

  @Delete("/:id")
  public async deletePaste(@Req() req: NextApiRequest, @Param("id") id: string) {
    const paste = await client
      .query<QueryData<Paste>>(Get(Ref(Collection("pastes"), id)))
      .catch(() => null);
    const session = await getSession({ req });

    if (!session) {
      throw new UnauthorizedException("You need to be logged in to continue");
    }

    if (!paste?.data) {
      throw new NotFoundException("That paste was not found");
    }

    if (paste.data.created_by?.name !== session.user?.name) {
      throw new HttpException(403, "This paste is not associated with your account");
    }

    await client.query(DeleteDb(Ref(Collection("pastes"), id)));

    return {
      status: "success",
    };
  }
}

export default createHandler(PastesRouter);
