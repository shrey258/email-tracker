import assert from "node:assert";
import { markOwnCopy } from "./mime.js";
import { BASE } from "./api.js";

const host = new URL(BASE).host;
const id = "3597490d-ed2f-431d-b402-e4c083539d3e", sig = "PP1PqxabFUs5ozGjjEXxBS_dOUP5eSzKXChs5vNl9kY";
const html = `<div dir=3D"ltr">H=C3=A9llo <a href=3D"https://${host}/c/${id}/${sig}/1">link</a><img src=3D"https:=\r\n//${host}/o/${id}/${sig}" width=3D"1" height=3D"1"></div>`;
const raw = [
  "MIME-Version: 1.0", "Subject: Hi", 'Content-Type: multipart/alternative; boundary="000b"', "",
  "--000b", 'Content-Type: text/plain; charset="UTF-8"', "", "Hello link", "",
  "--000b", 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: quoted-printable", "", html, "",
  "--000b--", "",
].join("\r\n");
const b64url = (s) => Buffer.from(s, "latin1").toString("base64url");

const mine = new Set([id]);
const out = Buffer.from(markOwnCopy(b64url(raw), mine), "base64url").toString("latin1");
const htmlPart = out.split("--000b")[2];
const decoded = Buffer.from(htmlPart.split("\r\n\r\n")[1].replace(/\s/g, ""), "base64").toString("utf8");
assert(decoded.includes(`/o/${id}/${sig}?me"`), "pixel marked");
assert(decoded.includes(`/c/${id}/${sig}/1?me"`), "link marked");
assert(decoded.includes("Héllo"), "text kept, UTF-8 intact");
assert(out.includes("Subject: Hi") && out.includes("Hello link"), "headers and plain part untouched");
assert.equal(markOwnCopy(b64url(out), mine), null, "already marked: nothing to do");
assert.equal(markOwnCopy(b64url(raw), new Set(["someone-elses-id"])), null, "another account's email: left alone");
assert.equal(markOwnCopy(b64url(raw.replace(host, "example.com").replace(host, "example.com").replace(`https:=\r\n//${host}`, "https://example.com")), mine), null, "not ours: nothing to do");
console.log("mime ok");
