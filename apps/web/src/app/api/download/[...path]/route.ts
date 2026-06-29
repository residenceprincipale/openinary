import { NextRequest, NextResponse } from "next/server"

function getInternalApiBase(): string {
  if (process.env.API_INTERNAL_URL) {
    return process.env.API_INTERNAL_URL.replace(/\/$/, "")
  }
  const fromPublic = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api$/, "")
  if (fromPublic && /^https?:\/\//i.test(fromPublic)) {
    return fromPublic
  }
  // Docker full-stack: API listens on 3002 inside the container
  return process.env.NODE_ENV === "production"
    ? "http://127.0.0.1:3002"
    : "http://localhost:3000"
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  if (!path?.length) {
    return NextResponse.json({ error: "File path is required" }, { status: 400 })
  }

  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/")
  const apiUrl = `${getInternalApiBase()}/download/${encodedPath}${request.nextUrl.search}`

  let response: Response
  try {
    response = await fetch(apiUrl)
  } catch (error) {
    console.error("[api/download] Proxy fetch failed:", apiUrl, error)
    return NextResponse.json({ error: "Download proxy failed" }, { status: 502 })
  }

  if (!response.ok) {
    const text = await response.text()
    return new NextResponse(text, { status: response.status })
  }

  const headers = new Headers()
  for (const name of ["content-type", "content-disposition", "content-length", "cache-control"]) {
    const value = response.headers.get(name)
    if (value) headers.set(name, value)
  }

  return new NextResponse(response.body, { status: response.status, headers })
}
