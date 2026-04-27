import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// 로컬 개발에서 Vercel 의 /api/* 서버리스 함수를 흉내내기 위한 미들웨어.
// 동일한 api/convert.js 를 import 해서 사용하므로, 배포 환경과 동일하게 동작한다.
function localApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: "local-api-middleware",
    configureServer(server) {
      // .env 의 OPENAI_API_KEY 등을 dev 서버 process 의 환경변수로 흘려준다.
      // 이렇게 하면 api/convert.js 가 process.env.OPENAI_API_KEY 로 접근 가능.
      for (const key of ["OPENAI_API_KEY"]) {
        if (env[key] && !process.env[key]) {
          process.env[key] = env[key];
        }
      }

      server.middlewares.use("/api/convert", async (req, res) => {
        try {
          // 동적 import — TS 에 대한 정적 모듈 해석을 피하기 위해 변수에 담아 호출.
          // (api/ 폴더는 src tsconfig 의 include 밖이며, Vercel 서버리스 진입점이다.)
          const specifier = "./api/convert.js";
          const mod = (await import(/* @vite-ignore */ specifier)) as {
            default: (req: unknown, res: unknown) => Promise<void>;
          };
          await mod.default(req, res);
        } catch (err) {
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: "Internal error (dev middleware)",
                detail: err instanceof Error ? err.message : String(err),
              })
            );
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), localApiPlugin(env)],
    server: {
      port: 5173,
      open: true,
    },
  };
});
