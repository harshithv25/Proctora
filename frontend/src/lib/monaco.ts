import * as monaco from 'monaco-editor';

export type SupportedLanguage = 'c' | 'js' | 'python' | 'cpp' | 'java';

export const LANGUAGE_OPTIONS: {
  id: SupportedLanguage;
  label: string;
  monacoLang: string;
  defaultBoilerplate: string;
}[] = [
  {
    id: 'c',
    label: 'C',
    monacoLang: 'c',
    defaultBoilerplate: `#include <stdio.h>\n\nint main() {\n    // Solution implementation\n    printf("Hello World\\n");\n    return 0;\n}\n`,
  },
  {
    id: 'cpp',
    label: 'C++',
    monacoLang: 'cpp',
    defaultBoilerplate: `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    // Solution implementation\n    cout << "Hello C++" << endl;\n    return 0;\n}\n`,
  },
  {
    id: 'python',
    label: 'Python',
    monacoLang: 'python',
    defaultBoilerplate: `def solution():\n    # Implement your algorithm here\n    pass\n\nif __name__ == "__main__":\n    solution()\n`,
  },
  {
    id: 'java',
    label: 'Java',
    monacoLang: 'java',
    defaultBoilerplate: `public class Solution {\n    public static void main(String[] args) {\n        // Solution implementation\n        System.out.println("Hello Java");\n    }\n}\n`,
  },
  {
    id: 'js',
    label: 'JavaScript',
    monacoLang: 'javascript',
    defaultBoilerplate: `/**\n * Solution Function\n */\nfunction solution() {\n    // Write your solution here\n    return true;\n}\n`,
  },
];

export function getMonacoLanguage(langId: SupportedLanguage): string {
  const found = LANGUAGE_OPTIONS.find((l) => l.id === langId);
  return found ? found.monacoLang : 'javascript';
}

export { monaco };
