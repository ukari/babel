import traverse from "../lib";
import assert from "assert";
import { parse } from "babylon";
import generate from "@babel/generator";
import * as t from "@babel/types";

function getPath(code, parserOpts) {
  const ast = parse(code, parserOpts);
  let path;
  traverse(ast, {
    Program: function(_path) {
      path = _path.get("body.0");
      _path.stop();
    },
  });

  return path;
}

function generateCode(path) {
  return generate(path.parentPath.node).code;
}

describe("modification", function() {
  describe("pushContainer", function() {
    it("pushes identifier into params", function() {
      const rootPath = getPath("function test(a) {}");
      rootPath.pushContainer("params", t.identifier("b"));

      assert.equal(generateCode(rootPath), "function test(a, b) {}");
    });

    it("pushes identifier into block", function() {
      const rootPath = getPath("function test(a) {}");
      const path = rootPath.get("body");
      path.pushContainer("body", t.expressionStatement(t.identifier("b")));

      assert.equal(generateCode(rootPath), "function test(a) {\n  b;\n}");
    });
  });
  describe("unshiftContainer", function() {
    it("unshifts identifier into params", function() {
      const rootPath = getPath("function test(a) {}");
      rootPath.unshiftContainer("params", t.identifier("b"));

      assert.equal(generateCode(rootPath), "function test(b, a) {}");
    });

    it("unshifts identifier into block", function() {
      const rootPath = getPath("function test(a) {}");
      const path = rootPath.get("body");
      path.unshiftContainer("body", t.expressionStatement(t.identifier("b")));

      assert.equal(generateCode(rootPath), "function test(a) {\n  b;\n}");
    });

    it("properly handles more than one arguments", function() {
      const code = "foo(a, b);";
      const ast = parse(code);
      traverse(ast, {
        CallExpression: function(path) {
          path.unshiftContainer("arguments", t.identifier("d"));
          assert.equal(generateCode(path), "foo(d, a, b);");
          path.unshiftContainer("arguments", t.stringLiteral("s"));
          assert.equal(generateCode(path), `foo("s", d, a, b);`);
        },
      });
    });
  });

  describe("insertBefore", function() {
    it("returns inserted path with BlockStatement", function() {
      const rootPath = getPath("if (x) { y; }");
      const path = rootPath.get("consequent.body.0");
      const result = path.insertBefore(t.identifier("b"));

      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
      assert.deepEqual(result[0].node, t.identifier("b"));
      assert.equal(generateCode(rootPath), "if (x) {\n  b\n  y;\n}");
    });

    it("returns inserted path without BlockStatement", function() {
      const rootPath = getPath("if (x) y;");
      const path = rootPath.get("consequent");
      const result = path.insertBefore(t.identifier("b"));

      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
      assert.deepEqual(result[0].node, t.identifier("b"));
      assert.equal(generateCode(rootPath), "if (x) {\n  b\n  y;\n}");
    });

    it("returns inserted path without BlockStatement without ExpressionStatement", function() {
      const rootPath = getPath("if (x) for (var i = 0; i < 0; i++) {}");
      const path = rootPath.get("consequent");
      const result = path.insertBefore(t.identifier("b"));

      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
      assert.deepEqual(result[result.length - 1].node, t.identifier("b"));
      assert.equal(
        generateCode(rootPath),
        "if (x) {\n  b\n\n  for (var i = 0; i < 0; i++) {}\n}",
      );
    });

    it("returns inserted path with BlockStatement without ExpressionStatement", function() {
      const rootPath = getPath("if (x) { for (var i = 0; i < 0; i++) {} }");
      const path = rootPath.get("consequent.body.0");
      const result = path.insertBefore(t.identifier("b"));

      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
      assert.deepEqual(result[result.length - 1].node, t.identifier("b"));
      assert.equal(
        generateCode(rootPath),
        "if (x) {\n  b\n\n  for (var i = 0; i < 0; i++) {}\n}",
      );
    });

    describe("when the parent is an export declaration inserts the node before", function() {
      it("the ExportNamedDeclaration", function() {
        const bodyPath = getPath("export function a() {}", {
          sourceType: "module",
        }).parentPath;
        const fnPath = bodyPath.get("body.0.declaration");
        fnPath.insertBefore(t.identifier("x"));

        assert.equal(bodyPath.get("body").length, 2);
        assert.deepEqual(bodyPath.get("body.0").node, t.identifier("x"));
      });

      it("the ExportDefaultDeclaration, if a declaration is exported", function() {
        const bodyPath = getPath("export default function () {}", {
          sourceType: "module",
        }).parentPath;
        const fnPath = bodyPath.get("body.0.declaration");
        fnPath.insertBefore(t.identifier("x"));

        assert.equal(bodyPath.get("body").length, 2);
        assert.deepEqual(bodyPath.get("body.0").node, t.identifier("x"));
      });

      it("the exported expression", function() {
        const declPath = getPath("export default 2;", {
          sourceType: "module",
        });
        const path = declPath.get("declaration");
        path.insertBefore(t.identifier("x"));

        assert.equal(generateCode(declPath), "export default (x, 2);");
      });
    });
  });

  describe("insertAfter", function() {
    it("returns inserted path with BlockStatement with ExpressionStatement", function() {
      const rootPath = getPath("if (x) { y; }");
      const path = rootPath.get("consequent.body.0");
      const result = path.insertAfter(t.identifier("b"));

      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
      assert.deepEqual(result[result.length - 1].node, t.identifier("b"));
      assert.equal(generateCode(rootPath), "if (x) {\n  y;\n  b\n}");
    });

    it("returns inserted path without BlockStatement with ExpressionStatement", function() {
      const rootPath = getPath("if (x) y;");
      const path = rootPath.get("consequent");
      const result = path.insertAfter(t.identifier("b"));

      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
      assert.deepEqual(result[result.length - 1].node, t.identifier("b"));
      assert.equal(generateCode(rootPath), "if (x) {\n  y;\n  b\n}");
    });

    it("returns inserted path without BlockStatement without ExpressionStatement", function() {
      const rootPath = getPath("if (x) for (var i = 0; i < 0; i++) {}");
      const path = rootPath.get("consequent");
      const result = path.insertAfter(t.identifier("b"));

      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
      assert.deepEqual(result[result.length - 1].node, t.identifier("b"));
      assert.equal(
        generateCode(rootPath),
        "if (x) {\n  for (var i = 0; i < 0; i++) {}\n\n  b\n}",
      );
    });

    it("returns inserted path with BlockStatement without ExpressionStatement", function() {
      const rootPath = getPath("if (x) { for (var i = 0; i < 0; i++) {} }");
      const path = rootPath.get("consequent.body.0");
      const result = path.insertAfter(t.identifier("b"));

      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
      assert.deepEqual(result[result.length - 1].node, t.identifier("b"));
      assert.equal(
        generateCode(rootPath),
        "if (x) {\n  for (var i = 0; i < 0; i++) {}\n\n  b\n}",
      );
    });

    describe("when the parent is an export declaration inserts the node after", function() {
      it("the ExportNamedDeclaration", function() {
        const bodyPath = getPath("export function a() {}", {
          sourceType: "module",
        }).parentPath;
        const fnPath = bodyPath.get("body.0.declaration");
        fnPath.insertAfter(t.identifier("x"));

        assert.equal(bodyPath.get("body").length, 2);
        assert.deepEqual(bodyPath.get("body.1").node, t.identifier("x"));
      });

      it("the ExportDefaultDeclaration, if a declaration is exported", function() {
        const bodyPath = getPath("export default function () {}", {
          sourceType: "module",
        }).parentPath;
        const fnPath = bodyPath.get("body.0.declaration");
        fnPath.insertAfter(t.identifier("x"));

        assert.equal(bodyPath.get("body").length, 2);
        assert.deepEqual(bodyPath.get("body.1").node, t.identifier("x"));
      });

      it("the exported expression", function() {
        const bodyPath = getPath("export default 2;", {
          sourceType: "module",
        }).parentPath;
        const path = bodyPath.get("body.0.declaration");
        path.insertAfter(t.identifier("x"));

        assert.equal(
          generateCode({ parentPath: bodyPath }),
          "var _temp;\n\nexport default (_temp = 2, x, _temp);",
        );
      });
    });
  });
});
