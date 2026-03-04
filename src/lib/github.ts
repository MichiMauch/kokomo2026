/**
 * GitHub Contents API wrapper for serverless environments
 * Used to read/write files in the repo (replaces fs-based pipeline scripts)
 */

function getConfig() {
  const owner = import.meta.env.GITHUB_REPO_OWNER || 'MichiMauch'
  const name = import.meta.env.GITHUB_REPO_NAME || 'kokomo2026'
  const branch = import.meta.env.GITHUB_BRANCH || 'main'
  const token = import.meta.env.GITHUB_TOKEN || import.meta.env.GITHUB_ACCESS_TOKEN
  if (!token) throw new Error('Missing GITHUB_TOKEN or GITHUB_ACCESS_TOKEN')
  return { owner, name, branch, token }
}

function headers(): Record<string, string> {
  const { token } = getConfig()
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

async function apiRequest(path: string, options?: RequestInit): Promise<Response> {
  const { owner, name } = getConfig()
  const url = `https://api.github.com/repos/${owner}/${name}/${path}`
  const res = await fetch(url, { ...options, headers: { ...headers(), ...options?.headers } })
  return res
}

/**
 * List all .md files in src/content/posts/
 */
export async function listPostFiles(): Promise<string[]> {
  const { branch } = getConfig()
  const res = await apiRequest('contents/src/content/posts?ref=' + branch)
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)

  const items: { name: string; type: string }[] = await res.json()
  return items
    .filter((item) => item.type === 'file' && item.name.endsWith('.md'))
    .map((item) => item.name)
}

/**
 * Get file content (decoded from base64)
 */
export async function getFileContent(path: string): Promise<string> {
  const { branch } = getConfig()
  const res = await apiRequest(`contents/${path}?ref=${branch}`)
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} for ${path}`)

  const data: { content: string; encoding: string } = await res.json()
  if (data.encoding === 'base64') {
    return atob(data.content.replace(/\n/g, ''))
  }
  return data.content
}

/**
 * Check if a file exists in the repo
 */
export async function fileExists(path: string): Promise<boolean> {
  const { branch } = getConfig()
  const res = await apiRequest(`contents/${path}?ref=${branch}`)
  return res.ok
}

/**
 * Create a file via PUT (triggers Vercel deploy)
 */
export async function createFile(
  path: string,
  content: string,
  commitMessage: string
): Promise<{ htmlUrl: string }> {
  const encoded = btoa(unescape(encodeURIComponent(content)))

  const res = await apiRequest(`contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: commitMessage,
      content: encoded,
      branch: getConfig().branch,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub create file failed: ${res.status} — ${err}`)
  }

  const data: { content: { html_url: string } } = await res.json()
  return { htmlUrl: data.content.html_url }
}
