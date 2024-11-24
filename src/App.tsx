import type { FC } from "hono/jsx";

const Layout: FC = (props) => {
  return (
    <html lang="en">
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script src="https://unpkg.com/@simplewebauthn/browser@11.0.0/dist/bundle/index.umd.min.js"></script>
      <script src="/script.js"></script>
      <link rel="stylesheet" href="/styles.css" />
      <title>hello deno</title>
      <body>{props.children}</body>
    </html>
  );
};

export const Top: FC = () => {
  return (
    <Layout>
      <body>
        <main>
          ユーザ名：<input type="text" id="userName" />
          <button onClick="register()" className="button">
            登録
          </button>
          <button onClick="verify()" className="button">
            認証
          </button>
          <br />
          <a href="/restricted">要認証のコンテンツを表示</a>
        </main>
      </body>
    </Layout>
  );
};
