import {
  SESSION_COOKIE_NAME,
  parseSession,
  buildDisplayName,
} from "./session";

describe("session utilities", () => {
  describe("SESSION_COOKIE_NAME", () => {
    it("has the correct cookie name", () => {
      expect(SESSION_COOKIE_NAME).toBe("optigrid_session");
    });
  });

  describe("parseSession", () => {
    it("returns null when value is undefined", () => {
      expect(parseSession(undefined)).toBeNull();
    });

    it("returns null when value is empty", () => {
      expect(parseSession("")).toBeNull();
    });

    it("parses a valid JSON session", () => {
      const raw = JSON.stringify({
        userId: "123",
        email: "Tali@example.com",
        firstName: "Tali",
        lastName: "Seaba",
        roleType: "ADMIN",
      });

      expect(parseSession(raw)).toEqual({
        userId: "123",
        email: "Tali@example.com",
        firstName: "Tali",
        lastName: "Seaba",
        roleType: "ADMIN",
      });
    });

    it("uses default values when optional fields are missing", () => {
      const raw = JSON.stringify({
        userId: "123",
        email: "Tali@example.com",
      });

      expect(parseSession(raw)).toEqual({
        userId: "123",
        email: "Tali@example.com",
        firstName: "",
        lastName: "",
        roleType: "VIEWER",
      });
    });

    it("returns null when userId is missing", () => {
      const raw = JSON.stringify({
        email: "Tali@example.com",
      });

      expect(parseSession(raw)).toBeNull();
    });

    it("returns null when email is missing", () => {
      const raw = JSON.stringify({
        userId: "123",
      });

      expect(parseSession(raw)).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      expect(parseSession("{invalid json")).toBeNull();
    });

    it("parses a URL-encoded session", () => {
      const encoded = encodeURIComponent(
        JSON.stringify({
          userId: "1",
          email: "Tali@example.com",
          firstName: "Tali",
          lastName: "Seaba",
          roleType: "ADMIN",
        })
      );

      expect(parseSession(encoded)).toEqual({
        userId: "1",
        email: "Tali@example.com",
        firstName: "Tali",
        lastName: "Seaba",
        roleType: "ADMIN",
      });
    });

    it("parses a twice URL-encoded session", () => {
      const twiceEncoded = encodeURIComponent(
        encodeURIComponent(
          JSON.stringify({
            userId: "1",
            email: "Tali@example.com",
            firstName: "Tali",
            lastName: "Seaba",
            roleType: "ADMIN",
          })
        )
      );

      expect(parseSession(twiceEncoded)).toEqual({
        userId: "1",
        email: "Tali@example.com",
        firstName: "Tali",
        lastName: "Seaba",
        roleType: "ADMIN",
      });
    });

    it("returns null when decoding does not produce valid JSON", () => {
      expect(parseSession("%7Bbad")).toBeNull();
    });

    it("returns null when the decoded value is unchanged and invalid", () => {
      expect(parseSession("not-json")).toBeNull();
    });
  });

  describe("buildDisplayName", () => {
    it("returns first and last name", () => {
      expect(
        buildDisplayName({
          firstName: "Tali",
          lastName: "Seaba",
          email: "Tali@example.com",
        })
      ).toBe("Tali Seaba");
    });

    it("returns first name when last name is empty", () => {
      expect(
        buildDisplayName({
          firstName: "Tali",
          lastName: "",
          email: "Tali@example.com",
        })
      ).toBe("Tali");
    });

    it("returns last name when first name is empty", () => {
      expect(
        buildDisplayName({
          firstName: "",
          lastName: "Seaba",
          email: "Tali@example.com",
        })
      ).toBe("Seaba");
    });

    it("returns email when both names are empty", () => {
      expect(
        buildDisplayName({
          firstName: "",
          lastName: "",
          email: "Tali@example.com",
        })
      ).toBe("Tali@example.com");
    });

    it("ignores surrounding whitespace", () => {
      expect(
        buildDisplayName({
          firstName: " Tali ",
          lastName: " Seaba ",
          email: "Tali@example.com",
        })
      ).toBe("Tali   Seaba");
    });
  });


  describe("additional parseSession coverage", () => {
  it("returns null when decodeURIComponent throws", () => {
    const spy = jest
      .spyOn(global, "decodeURIComponent")
      .mockImplementation(() => {
        throw new URIError("Bad URI");
      });

    expect(parseSession("%E0%A4%A")).toBeNull();

    spy.mockRestore();
  });

  it("returns null when decoded string is still not valid JSON", () => {
    const value = encodeURIComponent("not-json");

    expect(parseSession(value)).toBeNull();
  });

  it("returns null when decoded JSON is missing required fields", () => {
    const value = encodeURIComponent(
      JSON.stringify({
        firstName: "Tali",
      })
    );

    expect(parseSession(value)).toBeNull();
  });

  it("parses triple encoded JSON", () => {
    const value = encodeURIComponent(
      encodeURIComponent(
        encodeURIComponent(
          JSON.stringify({
            userId: "123",
            email: "Tali@example.com",
          })
        )
      )
    );

    expect(parseSession(value)).toEqual({
      userId: "123",
      email: "Tali@example.com",
      firstName: "",
      lastName: "",
      roleType: "VIEWER",
    });
  });

  it("returns null for JSON array", () => {
    expect(parseSession(JSON.stringify([]))).toBeNull();
  });

  it("returns null for JSON string", () => {
    expect(parseSession(JSON.stringify("hello"))).toBeNull();
  });

  it("returns null for JSON number", () => {
    expect(parseSession(JSON.stringify(123))).toBeNull();
  });

  it("returns null for JSON null", () => {
    expect(parseSession(JSON.stringify(null))).toBeNull();
  });

});

describe("additional buildDisplayName coverage", () => {
  it("trims leading and trailing whitespace", () => {
    expect(
      buildDisplayName({
        firstName: "  Tali",
        lastName: "Seaba  ",
        email: "Tali@test.com",
      })
    ).toBe("Tali Seaba");
  });

  it("falls back to email when names contain only whitespace", () => {
    expect(
      buildDisplayName({
        firstName: "   ",
        lastName: "   ",
        email: "Tali@test.com",
      })
    ).toBe("Tali@test.com");
  });

  it("uses first name when last name is whitespace", () => {
    expect(
      buildDisplayName({
        firstName: "Tali",
        lastName: "   ",
        email: "Tali@test.com",
      })
    ).toBe("Tali");
  });

  it("uses last name when first name is whitespace", () => {
    expect(
      buildDisplayName({
        firstName: "   ",
        lastName: "Seaba",
        email: "Tali@test.com",
      })
    ).toBe("Seaba");
  });


describe("additional buildDisplayName coverage", () => {
  it("trims leading and trailing whitespace", () => {
    expect(
      buildDisplayName({
        firstName: "  Tali",
        lastName: "Seaba  ",
        email: "Tali@test.com",
      })
    ).toBe("Tali Seaba");
  });

  it("falls back to email when names contain only whitespace", () => {
    expect(
      buildDisplayName({
        firstName: "   ",
        lastName: "   ",
        email: "Tali@test.com",
      })
    ).toBe("Tali@test.com");
  });

  it("uses first name when last name is whitespace", () => {
    expect(
      buildDisplayName({
        firstName: "Tali",
        lastName: "   ",
        email: "Tali@test.com",
      })
    ).toBe("Tali");
  });

  it("uses last name when first name is whitespace", () => {
    expect(
      buildDisplayName({
        firstName: "   ",
        lastName: "Seaba",
        email: "Tali@test.com",
      })
    ).toBe("Seaba");
  });

});

});

});