import { test } from "vitest";
import assert from "node:assert/strict";

import {
  buildCloudinaryFetchUrl,
  buildBloggerBatchDraftContent,
  buildBloggerBatchPostContentFromHostedImages,
  buildBloggerDraftResolveRequest,
  buildBloggerDraftFinalizeRequest,
  buildGoogleDriveDirectImageUrl,
  mapBloggerBatchCanonicalUrls,
} from "../../../../packages/types/src/blogger.ts";
import {
  applyBloggerOptimizerTemplate,
  buildBloggerImageTag,
  parseBloggerLabels,
} from "./blogger-shared.ts";

test("blogger-shared helpers behave consistently", () => {
assert.deepEqual(parseBloggerLabels(" action, romance ,action,, drama "), [
  "action",
  "romance",
  "drama",
]);

assert.deepEqual(parseBloggerLabels("weekly\nfeatured\n weekly "), [
  "weekly",
  "featured",
]);

assert.equal(
  applyBloggerOptimizerTemplate(
    "https://cdn.example.com/fetch/{{url}}",
    "https://blogger.googleusercontent.com/img/a.png",
  ),
  "https://cdn.example.com/fetch/https://blogger.googleusercontent.com/img/a.png",
);

assert.equal(
  applyBloggerOptimizerTemplate(
    "https://cdn.example.com/static-path",
    "https://blogger.googleusercontent.com/img/a.png",
  ),
  null,
);

assert.equal(
  buildBloggerImageTag("https://blogger.googleusercontent.com/img/a.png", 'Panel "01"'),
  '<img src="https://blogger.googleusercontent.com/img/a.png" alt="Panel &quot;01&quot;" />',
);

assert.deepEqual(
  buildBloggerDraftResolveRequest("123", "456"),
  {
    blogId: "123",
    postId: "456",
    fetchBody: true,
    fetchImages: true,
    view: "ADMIN",
  },
);

assert.deepEqual(
  buildBloggerDraftFinalizeRequest("123", "456", {
    title: "Batch draft",
    content: "<p>hello</p>",
    labels: ["cdn"],
  }),
  {
    blogId: "123",
    postId: "456",
    fetchBody: true,
    fetchImages: true,
    requestBody: {
      title: "Batch draft",
      content: "<p>hello</p>",
      labels: ["cdn"],
    },
  },
);

const batchContent = buildBloggerBatchDraftContent([
  {
    id: "img-1",
    fileName: "one.png",
    mimeType: "image/png",
    contentBase64: "AAA",
    altText: "First",
  },
  {
    id: "img-2",
    fileName: "two.jpg",
    mimeType: "image/jpeg",
    contentBase64: "BBB",
    altText: "Second",
  },
]);

assert.match(batchContent, /data:image\/png;base64,AAA/);
assert.match(batchContent, /data:image\/jpeg;base64,BBB/);

assert.deepEqual(
  mapBloggerBatchCanonicalUrls(
    [
      {
        id: "img-1",
        fileName: "one.png",
        mimeType: "image/png",
        contentBase64: "AAA",
        altText: "First",
      },
      {
        id: "img-2",
        fileName: "two.jpg",
        mimeType: "image/jpeg",
        contentBase64: "BBB",
        altText: "Second",
      },
    ],
    ["https://blogger.googleusercontent.com/a", "https://blogger.googleusercontent.com/b"],
  ),
  [
    {
      id: "img-1",
      fileName: "one.png",
      mimeType: "image/png",
      altText: "First",
      canonicalUrl: "https://blogger.googleusercontent.com/a",
    },
    {
      id: "img-2",
      fileName: "two.jpg",
      mimeType: "image/jpeg",
      altText: "Second",
      canonicalUrl: "https://blogger.googleusercontent.com/b",
    },
  ],
);

assert.equal(
  buildGoogleDriveDirectImageUrl("drive-file-id"),
  "https://lh3.googleusercontent.com/d/drive-file-id",
);

assert.equal(
  buildCloudinaryFetchUrl(
    {
      cloudName: "demo-cloud",
      transformation: "c_limit,f_auto,q_auto",
      resourceType: "image",
      deliveryType: "fetch",
      encodeSourceUrl: true,
    },
    "https://lh3.googleusercontent.com/d/drive-file-id",
  ),
  "https://res.cloudinary.com/demo-cloud/image/fetch/c_limit,f_auto,q_auto/https%3A%2F%2Flh3.googleusercontent.com%2Fd%2Fdrive-file-id",
);

const hostedBatchHtml = buildBloggerBatchPostContentFromHostedImages([
  {
    canonicalUrl: "https://lh3.googleusercontent.com/d/a",
    altText: "First",
    fileName: "one.png",
  },
  {
    canonicalUrl: "https://lh3.googleusercontent.com/d/b",
    altText: "",
    fileName: "two.jpg",
  },
]);

assert.match(hostedBatchHtml, /https:\/\/lh3\.googleusercontent\.com\/d\/a/);
assert.match(hostedBatchHtml, /https:\/\/lh3\.googleusercontent\.com\/d\/b/);

});
