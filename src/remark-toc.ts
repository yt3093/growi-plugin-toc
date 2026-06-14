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

function buildListItem(entry: HeadingEntry): ListItem {
  const link: Link = {
    type: 'link',
    url: `#${entry.slug}`,
    children: [{ type: 'text', value: entry.text } as Text],
  };
  const indent = Math.max(0, entry.depth - 1);
  return {
    type: 'listItem',
    spread: false,
    data: {
      hProperties: { className: [`growi-plugin-toc-item-l${entry.depth}`], style: `margin-left: ${indent * 1.2}em` },
    },
    children: [{ type: 'paragraph', children: [link] } as Paragraph],
  };
}

function buildTocList(headings: HeadingEntry[], maxDepth: number): List {
  const filtered = headings.filter(h => h.depth <= maxDepth);

  const list: List = {
    type: 'list',
    ordered: false,
    spread: false,
    children: filtered.map(buildListItem),
    data: {
      hProperties: { className: ['growi-plugin-toc'] },
    },
  };

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
