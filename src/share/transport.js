// How review copies travel and how comments come back.
//
// Today Booky uses the "file" transport: the author shares the encrypted review file
// (email attachment or a Google Drive / Dropbox / OneDrive link) and imports the
// .bookyreview file the reviewer sends back.
//
// An online transport can be added later without changing the rest of the app. It must
// implement the same interface, e.g. backed by Supabase or Firebase:
//   publish({ book, reviewer, html, roundId })  -> Promise<{ url }>     // host the encrypted file, return a link
//   invite({ reviewer, url, message })          -> Promise<void>        // send the email (server-side)
//   pull({ book })                               -> Promise<reviewFile[]> // fetch new .bookyreview payloads
// The review page would then POST comments to the backend instead of downloading a file.
// Because copies are encrypted on the author's computer, the server never sees the book text.

export const fileTransport = {
  id: 'file',
  label: 'Review file (email attachment or cloud link)',
  online: false,
};

const transports = { file: fileTransport };

export function registerTransport(t) { transports[t.id] = t; }
export function getTransport(id = 'file') { return transports[id] || fileTransport; }
