import { describe, expect, it } from "vitest";
import { parseMapsUrl } from "@/lib/google/maps-url";

describe("parseMapsUrl", () => {
  it("reads a decimal cid", () => {
    expect(parseMapsUrl("http://maps.google.com/?cid=8037566491034839561").cid).toBe(
      "8037566491034839561",
    );
  });

  it("converts the hex feature id in saved-list URLs to a cid", () => {
    const info = parseMapsUrl(
      "https://www.google.com/maps/place/Katz's+Delicatessen/data=!4m2!3m1!1s0x89c25984a7cf5a2b:0x6f8b3f8e1e1c2d09",
    );
    expect(info.cid).toBe(BigInt("0x6f8b3f8e1e1c2d09").toString());
    expect(info.name).toBe("Katz's Delicatessen");
  });

  it("reads dropped-pin coordinates", () => {
    const info = parseMapsUrl("https://www.google.com/maps/search/40.7127753,-74.0059728");
    expect(info).toMatchObject({ lat: 40.7127753, lng: -74.0059728 });
    expect(info.name).toBeUndefined();
  });

  it("prefers !3d!4d place coordinates over the viewport", () => {
    const info = parseMapsUrl(
      "https://www.google.com/maps/place/Foo/@40.1,-73.1,15z/data=!3m1!4b1!4m5!3m4!8m2!3d40.72!4d-73.99",
    );
    expect(info).toMatchObject({ lat: 40.72, lng: -73.99 });
  });

  it("ignores garbage", () => {
    expect(parseMapsUrl("not a url")).toEqual({});
    expect(parseMapsUrl(undefined)).toEqual({});
  });
});
