import { getSession } from "next-auth/client";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import * as React from "react";
import { Session } from "next-auth";
import { GetServerSideProps, NextPage } from "next";
import { Layout } from "@components/Layout/Layout";
import { Paste } from "types/Paste";
import styles from "@css/pastes.module.scss";
import { handleRequest } from "@lib/fetch";

interface Props {
  paste: Paste | null;
  session: Session;
}

const EditPastePage: NextPage<Props> = ({ paste, session }) => {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (!paste) return;
    setBody(paste.text);
    setTitle(paste.title);
  }, [paste]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await handleRequest(`/pastes/${paste.id}`, "PUT", {
        title,
        text: body,
      });

      if (data.status === "success") {
        router.push(`/pastes/${paste.id}`);
      } else {
        toast.error("An unexpected error occurred");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message);
    }

    setLoading(false);
  }

  if (!paste) {
    return (
      <Layout showNav>
        <p>Paste was not found!</p>
      </Layout>
    );
  }

  if (paste?.created_by?.name !== session.user?.name) {
    return (
      <Layout showNav>
        <p>This paste is not associated with your account!</p>
      </Layout>
    );
  }

  return (
    <Layout showNav toast>
      <form onSubmit={onSubmit}>
        <div className={styles.form_group}>
          <label htmlFor="paste_title">Paste Title</label>

          <input
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            id="paste_title"
            className={styles.form_input}
          />
        </div>

        <div className={styles.form_group}>
          <label htmlFor="paste_body">Paste Body</label>

          <textarea
            spellCheck="false"
            autoComplete="false"
            autoCorrect="false"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
            id="paste_body"
            className={styles.form_input}
          ></textarea>
        </div>

        <div style={{ float: "right" }}>
          <button disabled={loading} className={styles.form_btn}>
            {loading ? "loading.." : "Update"}
          </button>
        </div>
      </form>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ req, query }) => {
  const res = await handleRequest(`/pastes/${query.id}`).catch(() => null);
  const session = await getSession({ req });

  return {
    props: {
      paste: res?.data ?? null,
      session: session ?? null,
    },
  };
};

export default EditPastePage;