import { bunnyUpload } from "./bunnyStorage";
import { apiUrl } from "./api";
import { useAuthStore } from "../store/useAuthStore";

export async function uploadAvatar(
  file: File,
  userId: string,
): Promise<string> {
  // Validate file type
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image.");
  }

  // Validate file size (max 5MB)
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("Image is too large (max 5MB).");
  }

  // Ensure the caller is uploading their own avatar
  const currentUser = useAuthStore.getState().user;
  if (!currentUser || currentUser.id !== userId) {
    throw new Error("You must be logged in to upload an avatar.");
  }

  // Generate clean storage path: avatars/{userId}/{timestamp}.{ext}
  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `avatars/${userId}/${Date.now()}.${fileExt}`;

  try {
    // Upload to Bunny CDN via Hetzner backend proxy
    const { cdnUrl } = await bunnyUpload(file, storagePath, file.type);

    if (!cdnUrl) {
      throw new Error("Failed to retrieve public CDN URL after upload.");
    }

    // Persist the new avatar URL to the user's profile on the backend
    const token = useAuthStore.getState().session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const patchRes = await fetch(apiUrl(`/api/profiles/${userId}`), {
      method: "PATCH",
      headers,
      credentials: "include",
      body: JSON.stringify({ avatarUrl: cdnUrl }),
    });

    if (!patchRes.ok) {
      const detail = await patchRes.text().catch(() => "");
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'avatarUpload.ts:patch',message:'profile_patch_failed',data:{status:patchRes.status,detailLen:detail?.length??0},timestamp:Date.now(),hypothesisId:'H-avatar-db'})}).catch(()=>{});
      // #endregion
      throw new Error(
        `Profile did not save (${patchRes.status}). Photo uploaded but avatar URL was not stored.`,
      );
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/611a0f9e-8521-4b88-9b6c-9dfeb5de00cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'avatarUpload.ts:patch',message:'profile_patch_ok',data:{status:patchRes.status},timestamp:Date.now(),hypothesisId:'H-avatar-db'})}).catch(()=>{});
    // #endregion

    return cdnUrl;
  } catch (err: any) {
    throw new Error(err?.message || "Failed to upload avatar");
  }
}
