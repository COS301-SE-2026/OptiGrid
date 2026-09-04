"""Measure Python functions without importing or executing application modules."""
import ast
import json
import pathlib
import sys
import radon
from radon.complexity import cc_visit_ast
from radon.visitors import Function

policy = json.loads(pathlib.Path(__file__).with_name('complexity-policy.json').read_text())

def measure(source):
    tree = ast.parse(source)
    functions = []
    class Collector(ast.NodeVisitor):
        def __init__(self):
            self.scope = []

        def visit_ClassDef(self, node):
            self.scope.append(node.name)
            self.generic_visit(node)
            self.scope.pop()

        def visit_FunctionDef(self, node):
            block = next(b for b in cc_visit_ast(node) if isinstance(b, Function) and b.lineno == node.lineno and b.name == node.name)
            functions.append({'name': '.'.join(self.scope + [node.name]), 'line': node.lineno, 'column': node.col_offset + 1, 'endLine': node.end_lineno, 'complexity': block.complexity})
            self.scope.append(node.name)
            self.generic_visit(node)
            self.scope.pop()

        visit_AsyncFunctionDef = visit_FunctionDef

        def visit_Lambda(self, node):
            # Radon does not list lambdas as separate functions. Measure a synthetic
            # function with the same arguments/body, and retain the original location.
            wrapped = ast.FunctionDef(name='_nfr_lambda', args=node.args, body=[ast.Return(value=node.body)], decorator_list=[], returns=None, type_comment=None, type_params=[])
            ast.copy_location(wrapped, node)
            ast.fix_missing_locations(wrapped)
            block = next(b for b in cc_visit_ast(wrapped) if isinstance(b, Function))
            functions.append({'name': '.'.join(self.scope + ['<lambda>']), 'line': node.lineno, 'column': node.col_offset + 1, 'endLine': node.end_lineno, 'complexity': block.complexity})
            self.generic_visit(node)

    Collector().visit(tree)
    return functions

def self_test():
    def code(count):
        return 'def boundary(x):\n' + ''.join(f'    if x == {i}:\n        return {i}\n' for i in range(count)) + '    return -1\n'
    cases = [
        ('at-limit', code(9), [10]),
        ('above-limit', code(10), [11]),
        ('nested-function', 'def outer():\n' + ''.join('    ' + line + '\n' for line in code(10).splitlines()) + '    return boundary\n', [1, 11]),
        ('method-and-lambda', 'class C:\n    def method(self):\n        return lambda x: 1 if x else 0\n', [2, 2]),
        ('async-function', 'async def action(x):\n    if x:\n        return 1\n    return 0\n', [2]),
    ]
    results = []
    for name, source, expected in cases:
        scores = sorted(f['complexity'] for f in measure(source))
        results.append({'name': name, 'expectedScores': expected, 'actualScores': scores, 'passed': scores == expected})
    try:
        measure('def broken(')
        syntax_caught = False
    except SyntaxError:
        syntax_caught = True
    results.append({'name': 'parser-error', 'passed': syntax_caught})
    return results

def main():
    root = pathlib.Path(sys.argv[1])
    output = pathlib.Path(sys.argv[2])
    functions = []
    errors = []
    components = {}
    for service in ['ingestion', 'analytics']:
        files = sorted((root / 'backend' / service / 'src').rglob('*.py'))
        components[service] = {'files': len(files), 'functions': 0, 'violations': 0, 'maximum': 0}
        for file in files:
            if any(part in {'__pycache__', 'generated', '__mocks__'} for part in file.parts):
                continue
            name = file.relative_to(root).as_posix()
            try:
                measured = measure(file.read_text(encoding='utf-8-sig'))
                functions.extend({'file': name, 'component': service, **f} for f in measured)
                components[service]['functions'] += len(measured)
                components[service]['violations'] += sum(f['complexity'] > policy['maximum'] for f in measured)
                components[service]['maximum'] = max([components[service]['maximum']] + [f['complexity'] for f in measured])
            except (SyntaxError, UnicodeError, StopIteration) as exc:
                errors.append({'file': name, 'message': str(exc)})
    functions.sort(key=lambda f: (-f['complexity'], f['file'], f['line']))
    fixtures = self_test()
    violations = [f for f in functions if f['complexity'] > policy['maximum']]
    passed = bool(functions) and not errors and not violations and all(f['passed'] for f in fixtures)
    result = {'analyzer': f'Radon {radon.__version__}', 'python': sys.version, 'policy': policy, 'filesChecked': sum(c['files'] for c in components.values()), 'functionsChecked': len(functions), 'components': components, 'functions': functions, 'violations': violations, 'errors': errors, 'fixtures': fixtures, 'passed': passed}
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({k: result[k] for k in ['analyzer', 'filesChecked', 'functionsChecked', 'components', 'errors', 'fixtures', 'passed']}, indent=2))
    return 0 if passed else 1

if __name__ == '__main__':
    sys.exit(main())
