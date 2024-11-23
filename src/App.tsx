import type { FC } from "hono/jsx";

const Layout: FC = (props) => {
  return (
    <html lang="en">
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="stylesheet" href="/public/styles.css" />
      <title>hello deno</title>
      <body>{props.children}</body>
    </html>
  );
};

export const Top: FC<{ messages: string[] }> = (props: { messages: string[] }) => {
  return (
    <Layout>
      <h1 class="text-2xl font-bold underline">
        Hello world!
      </h1>
      <ul>
        {props.messages.map((message) => {
          return <li>{message}!!</li>;
        })}
      </ul>
    </Layout>
  );
};
