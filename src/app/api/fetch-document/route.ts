import { NextRequest, NextResponse } from "next/server";

const CH_DOC_BASE =
  "https://document-api.company-information.service.gov.uk";

function chAuth(): string {
  const key = process.env.COMPANIES_HOUSE_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

/**
 * GET /api/fetch-document?metadataUrl=/document/{id}
 *
 * Proxies a Companies House document through the server and returns the
 * PDF as a base64 string. Uses the same Basic Auth as the main CH API.
 *
 * The metadataUrl value is the `links.document_metadata` path from a
 * filing history item, e.g. "/document/OTgzMzg4NzQ1OWFk..."
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const metadataUrl = searchParams.get("metadataUrl");

  if (!metadataUrl) {
    return NextResponse.json({ error: "Missing metadataUrl" }, { status: 400 });
  }

  // Extract the document ID from a path like /document/{id}
  const match = metadataUrl.match(/\/document\/([^/?]+)/);
  if (!match) {
    return NextResponse.json(
      { error: "Could not parse document ID from metadataUrl" },
      { status: 400 }
    );
  }
  const documentId = match[1];

  try {
    const res = await fetch(
      `${CH_DOC_BASE}/document/${documentId}/content`,
      {
        headers: {
          Authorization: chAuth(),
          Accept: "application/pdf",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Companies House document API returned ${res.status}` },
        { status: res.status }
      );
    }

    const buffer = await res.arrayBuffer();

    // Sanity-check size before base64-encoding
    if (buffer.byteLength > 20 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Document exceeds 20 MB size limit" },
        { status: 413 }
      );
    }

    return NextResponse.json({
      documentId,
      base64: Buffer.from(buffer).toString("base64"),
      contentType: res.headers.get("content-type") ?? "application/pdf",
      sizeBytes: buffer.byteLength,
    });
  } catch (err) {
    console.error("[fetch-document]", err);
    return NextResponse.json(
      { error: "Failed to fetch document from Companies House" },
      { status: 502 }
    );
  }
}
