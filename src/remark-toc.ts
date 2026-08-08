import GithubSlugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';
import type {
  Heading, Link, LinkReference, List, ListItem, Paragraph, PhrasingContent, Root, Text,
} from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const TOC_PATTERN = /^\[TOC(?:\s+level=(\d+))?\]$/i;

type HeadingEntry = {
  depth: number;
  text: string;
  slug: string;
};

type HeadingNode = HeadingEntry & {
  children: HeadingNode[];
};

function collectHeadings(tree: Root): HeadingEntry[] {
  const slugger = new GithubSlugger();
  const headings: HeadingEntry[] = [];

  visit(tree, 'heading', (node: Heading) => {
    const text = toString(node);
    const slug = slugger.slug(text);
    headings.push({ depth: node.depth, text, slug });
  });

  return headings;
}

function buildTree(headings: HeadingEntry[]): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const entry of headings) {
    const node: HeadingNode = { ...entry, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].depth >= entry.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    }
    else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

function buildListItem(node: HeadingNode): ListItem {
  const link: Link = {
    type: 'link',
    url: `#${node.slug}`,
    children: [{ type: 'text', value: node.text } as Text],
  };

  const children: ListItem['children'] = [{ type: 'paragraph', children: [link] } as Paragraph];
  if (node.children.length > 0) {
    children.push(buildList(node.children));
  }

  return {
    type: 'listItem',
    spread: false,
    data: {
      hProperties: { className: [`growi-plugin-toc-item-l${node.depth}`] },
    },
    children,
  };
}

function buildList(nodes: HeadingNode[]): List {
  return {
    type: 'list',
    ordered: false,
    spread: false,
    children: nodes.map(buildListItem),
  };
}

function buildTocList(headings: HeadingEntry[], maxDepth: number): List {
  const filtered = headings.filter(h => h.depth <= maxDepth);
  const tree = buildTree(filtered);
  const list = buildList(tree);
  list.data = { hProperties: { className: ['growi-plugin-toc'] } };

  return list;
}

function reconstructSource(children: PhrasingContent[]): string | null {
  let out = '';
  for (const child of children) {
    if (child.type === 'text') {
      out += (child as Text).value;
    }
    else if (child.type === 'linkReference') {
      const lr = child as LinkReference;
      const label = lr.label ?? toString(lr);
      out += `[${label}]`;
    }
    else {
      return null;
    }
  }
  return out;
}

export const remarkToc: Plugin<[], Root> = () => (tree) => {
  const headings = collectHeadings(tree);

  if (headings.length === 0) return;

  visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
    if (parent == null || index == null) return;

    const reconstructed = reconstructSource(node.children);
    if (reconstructed == null) return;

    const match = TOC_PATTERN.exec(reconstructed.trim());
    if (match == null) return;

    const maxDepth = match[1] != null ? Math.min(6, Math.max(1, parseInt(match[1], 10))) : 6;
    (parent.children as Root['children'])[index] = buildTocList(headings, maxDepth);
  });
};
