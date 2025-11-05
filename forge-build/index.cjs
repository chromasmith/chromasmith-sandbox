const PREVIEW_HOST = "https://forgeview.chromasmith.com";

async function build_prepare_forgeview({ repo_name, temp_allowed = true, channel = "1" }) {
  const preview_url = `${PREVIEW_HOST}/channel/${channel}/preview/${encodeURIComponent(repo_name)}`;
  const repo_url = `https://github.com/your-org/${encodeURIComponent(repo_name)}`;
  return { status: "ok", preview_url, repo_url };
}

async function build_deploy_preview({ repo_name, confirm_token }) {
  const vercel_preview_url = `https://preview.vercel.example.com/${encodeURIComponent(repo_name)}`;
  return { status: "ok", vercel_preview_url };
}

async function build_deploy_production({ repo_name, domain, confirm_token }) {
  const public_url = `https://${domain}`;
  return { status: "ok", public_url };
}

module.exports = {
  build_prepare_forgeview,
  build_deploy_preview,
  build_deploy_production,
};

