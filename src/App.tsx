import type { FC } from "hono/jsx";

const Layout: FC = (props) => {
  return (
    <html lang="en">
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script src="/dist/script.js" type="module"></script>
      <title>hello deno</title>
      <body>{props.children}</body>
    </html>
  );
};

export const Top: FC = () => {
  return (
    <Layout>
      <body>
        <main class="js-auth">
          ユーザ名：<input type="text" class="userName" />
          <button class="js-register">
            登録
          </button>
          <button class="js-verify">
            認証
          </button>
          <br />
          <a href="/restricted">要認証のコンテンツを表示</a>
        </main>
      </body>
    </Layout>
  );
};
