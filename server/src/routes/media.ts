import { FastifyInstance } from "fastify";
import { config } from "../utils/config";

export async function mediaRoutes(fastify: FastifyInstance) {
  // ── POST /api/media/upload-file ────────────────────────────────────
  // Proxies a raw binary upload from the browser to Bunny Storage.
  // The Bunny API key stays server-side only.
  //
  // Query params:
  //   path  — storage path, e.g. "videos/userId/videoId/original.mp4"
  //   ct    — MIME type,    e.g. "video/mp4"
  // Body: raw binary (Content-Type: application/octet-stream)
  fastify.post<{
    Querystring: { path: string; ct: string };
  }>(
    "/upload-file",
    { bodyLimit: 600 * 1024 * 1024 }, // 600 MB limit for large video files
    async (request, reply) => {
      const { path, ct } = request.query;

      if (!path || !ct) {
        return reply
          .code(400)
          .send({ error: "path and ct query params are required" });
      }

      if (!config.bunnyStorageZone || !config.bunnyStorageApiKey) {
        return reply.code(503).send({
          error:
            "Bunny storage not configured. Set BUNNY_STORAGE_ZONE and BUNNY_STORAGE_API_KEY in .env",
        });
      }

      const body = request.body as Buffer;
      const region = config.bunnyStorageRegion || "de";
      const bunnyUrl = `https://${region}.storage.bunnycdn.com/${config.bunnyStorageZone}/${path}`;

      let uploadRes: Response;
      try {
        uploadRes = await fetch(bunnyUrl, {
          method: "PUT",
          headers: {
            AccessKey: config.bunnyStorageApiKey,
            "Content-Type": ct,
          },
          body,
        });
      } catch (err) {
        fastify.log.error({ err }, "[Bunny] Network error reaching storage");
        return reply.code(502).send({ error: "Could not reach Bunny Storage" });
      }

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "");
        fastify.log.error(
          { status: uploadRes.status, text },
          "[Bunny] Upload rejected",
        );
        return reply
          .code(500)
          .send({ error: `Bunny upload failed (${uploadRes.status})` });
      }

      const cdnHostname =
        config.bunnyCdnHostname || `${config.bunnyStorageZone}.b-cdn.net`;

      return reply.send({
        path,
        cdnUrl: `https://${cdnHostname}/${path}`,
      });
    },
  );

  // ── DELETE /api/media/delete ───────────────────────────────────────
  // Delete a file from Bunny Storage by storage path.
  // Body JSON: { path: string }
  fastify.delete<{
    Body: { path: string };
  }>(
    "/delete",
    { preHandler: (fastify as any).verifyJWT },
    async (request, reply) => {
      const { path } = request.body ?? {};

      if (!path) {
        return reply.code(400).send({ error: "path is required" });
      }

      if (!config.bunnyStorageZone || !config.bunnyStorageApiKey) {
        return reply.code(503).send({ error: "Bunny storage not configured" });
      }

      const region = config.bunnyStorageRegion || "de";
      const bunnyUrl = `https://${region}.storage.bunnycdn.com/${config.bunnyStorageZone}/${path}`;

      let deleteRes: Response;
      try {
        deleteRes = await fetch(bunnyUrl, {
          method: "DELETE",
          headers: { AccessKey: config.bunnyStorageApiKey },
        });
      } catch (err) {
        fastify.log.error({ err }, "[Bunny] Network error on delete");
        return reply.code(502).send({ error: "Could not reach Bunny Storage" });
      }

      if (!deleteRes.ok && deleteRes.status !== 404) {
        return reply
          .code(500)
          .send({ error: `Bunny delete failed (${deleteRes.status})` });
      }

      return reply.send({ success: true, path });
    },
  );

  // ── POST /api/media/upload ─────────────────────────────────────────
  // Legacy: returns a signed upload URL + headers so the client can PUT
  // directly to Bunny Storage (kept for reference / non-browser clients).
  fastify.post("/upload", async (request, reply) => {
    const { path, contentType } = request.body as {
      path: string;
      contentType: string;
    };

    if (!path || !contentType) {
      return reply
        .code(400)
        .send({ error: "path and contentType are required" });
    }

    if (!config.bunnyStorageZone || !config.bunnyStorageApiKey) {
      return reply.code(503).send({ error: "Bunny storage not configured" });
    }

    const region = config.bunnyStorageRegion || "de";
    const url = `https://${region}.storage.bunnycdn.com/${config.bunnyStorageZone}/${path}`;

    return reply.send({
      url,
      path,
      method: "PUT",
      headers: {
        AccessKey: config.bunnyStorageApiKey,
        "Content-Type": contentType,
      },
    });
  });

  // ── GET /api/media/public/:path* ───────────────────────────────────
  // Returns the CDN public URL for a stored file path.
  fastify.get("/public/:path*", async (request, reply) => {
    const filePath = (request.params as any).path as string;

    if (!filePath) {
      return reply.code(400).send({ error: "path is required" });
    }

    const cdnHostname =
      config.bunnyCdnHostname || `${config.bunnyStorageZone}.b-cdn.net`;

    if (!cdnHostname) {
      return reply
        .code(503)
        .send({ error: "Bunny CDN hostname not configured" });
    }

    return reply.send({ url: `https://${cdnHostname}/${filePath}` });
  });
}
