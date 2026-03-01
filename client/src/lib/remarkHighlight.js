// Converts ==text== → <mark>text</mark> during markdown parsing
import { visit } from 'unist-util-visit';

export function remarkHighlight() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      const regex = /==(.+?)==/g;
      let match;
      const nodes = [];
      let lastIndex = 0;

      while ((match = regex.exec(node.value)) !== null) {
        // Text before the match
        if (match.index > lastIndex) {
          nodes.push({ type: 'text', value: node.value.slice(lastIndex, match.index) });
        }
        // The highlighted span
        nodes.push({
          type: 'html',
          value: `<mark>${match[1]}</mark>`,
        });
        lastIndex = regex.lastIndex;
      }

      // Remaining text after last match
      if (nodes.length > 0) {
        if (lastIndex < node.value.length) {
          nodes.push({ type: 'text', value: node.value.slice(lastIndex) });
        }
        parent.children.splice(index, 1, ...nodes);
      }
    });
  };
}