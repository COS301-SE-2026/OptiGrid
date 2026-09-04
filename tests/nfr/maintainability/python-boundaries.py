"""Check Python service independence using stdlib AST, without importing services."""
import ast
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
violations = []
errors = []
checked = 0
for service, forbidden in [('ingestion', 'backend.analytics'), ('analytics', 'backend.ingestion')]:
    for file in sorted((root / 'backend' / service / 'src').glob('**/*.py')):
        checked += 1
        try:
            tree = ast.parse(file.read_text(encoding='utf-8-sig'), filename=str(file))
            package = '.'.join(file.parent.relative_to(root).parts)
            for node in ast.walk(tree):
                names = []
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    base = node.module or ''
                    if node.level:
                        parts = package.split('.')
                        base = '.'.join(parts[:len(parts) - node.level + 1] + ([base] if base else []))
                    names = [base] + [f'{base}.{alias.name}' for alias in node.names]
                for name in names:
                    if name == forbidden or name.startswith(forbidden + '.'):
                        violations.append({'file': file.relative_to(root).as_posix(), 'line': node.lineno, 'dependency': name})
        except (SyntaxError, UnicodeError) as exc:
            errors.append({'file': str(file.relative_to(root)), 'message': str(exc)})
result = {'filesChecked': checked, 'scope': 'Static Python import/from statements; dynamic imports are not covered.', 'violations': violations, 'errors': errors, 'passed': checked > 0 and not violations and not errors}
print(json.dumps(result, indent=2))
sys.exit(0 if result['passed'] else 1)
