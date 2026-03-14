/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Binary tree for split-view panel layout management.
 * Leaf nodes represent tabs, internal nodes represent splits (row/column).
 */

export class SplitLeafNode {
  constructor(tabId) {
    this.type = "leaf";
    this.tabId = tabId;
    this.parent = null;
    this.sizeInParent = 50; // percentage of parent space
  }

  serialize() {
    return { type: "leaf", tabId: this.tabId, size: this.sizeInParent };
  }
}

export class SplitNode {
  constructor(direction) {
    this.type = "split";
    this.direction = direction; // 'row' or 'column'
    this.children = [];
    this.parent = null;
  }

  addChild(node) {
    node.parent = this;
    this.children.push(node);
  }

  removeChild(node) {
    const idx = this.children.indexOf(node);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      node.parent = null;
    }
  }

  serialize() {
    return {
      type: "split",
      direction: this.direction,
      children: this.children.map(c => c.serialize()),
    };
  }
}

export class SplitViewTree {
  constructor() {
    this.root = null;
  }

  // Insert a new tab alongside an existing leaf, splitting in the given direction
  // side: 'left' | 'right' | 'top' | 'bottom'
  insertNode(existingLeaf, newTabId, side) {
    const direction = (side === "left" || side === "right") ? "row" : "column";
    const newLeaf = new SplitLeafNode(newTabId);
    const parent = existingLeaf.parent;
    const splitNode = new SplitNode(direction);

    if (side === "left" || side === "top") {
      splitNode.addChild(newLeaf);
      splitNode.addChild(existingLeaf);
    } else {
      splitNode.addChild(existingLeaf);
      splitNode.addChild(newLeaf);
    }

    newLeaf.sizeInParent = 50;
    existingLeaf.sizeInParent = 50;

    if (!parent) {
      this.root = splitNode;
    } else {
      const idx = parent.children.indexOf(existingLeaf);
      parent.children[idx] = splitNode;
      splitNode.parent = parent;
    }
    existingLeaf.parent = splitNode;

    return newLeaf;
  }

  // Remove a leaf node, collapsing parent if only one child remains
  removeNode(leaf) {
    const parent = leaf.parent;
    if (!parent) {
      this.root = null;
      return;
    }
    parent.removeChild(leaf);

    if (parent.children.length === 1) {
      const remaining = parent.children[0];
      const grandParent = parent.parent;
      if (!grandParent) {
        this.root = remaining;
        remaining.parent = null;
      } else {
        const idx = grandParent.children.indexOf(parent);
        grandParent.children[idx] = remaining;
        remaining.parent = grandParent;
        remaining.sizeInParent = parent.sizeInParent || 50;
      }
    } else {
      // Redistribute space among remaining children
      const total = parent.children.reduce((sum, c) => sum + c.sizeInParent, 0);
      for (const child of parent.children) {
        child.sizeInParent = (child.sizeInParent / total) * 100;
      }
    }
  }

  // Swap positions of two leaf nodes
  swapNodes(leaf1, leaf2) {
    const tempTabId = leaf1.tabId;
    leaf1.tabId = leaf2.tabId;
    leaf2.tabId = tempTabId;
  }

  // Calculate CSS inset positions for all leaves
  // Returns Map<tabId, {top, right, bottom, left}> as percentages
  calculatePositions(node = this.root, bounds = { top: 0, right: 0, bottom: 0, left: 0 }) {
    const positions = new Map();
    if (!node) return positions;

    if (node.type === "leaf") {
      positions.set(node.tabId, { ...bounds });
      return positions;
    }

    const availableWidth = 100 - bounds.left - bounds.right;
    const availableHeight = 100 - bounds.top - bounds.bottom;
    let offset = 0;

    for (const child of node.children) {
      const childBounds = { ...bounds };
      const size = child.sizeInParent;

      if (node.direction === "row") {
        childBounds.left = bounds.left + (offset / 100) * availableWidth;
        childBounds.right = 100 - childBounds.left - (size / 100) * availableWidth;
      } else {
        childBounds.top = bounds.top + (offset / 100) * availableHeight;
        childBounds.bottom = 100 - childBounds.top - (size / 100) * availableHeight;
      }

      const childPositions = this.calculatePositions(child, childBounds);
      for (const [id, pos] of childPositions) {
        positions.set(id, pos);
      }
      offset += size;
    }
    return positions;
  }

  serialize() {
    return this.root ? this.root.serialize() : null;
  }

  static deserialize(data) {
    const tree = new SplitViewTree();
    if (!data) return tree;
    tree.root = SplitViewTree._deserializeNode(data);
    return tree;
  }

  static _deserializeNode(data, parent = null) {
    if (data.type === "leaf") {
      const leaf = new SplitLeafNode(data.tabId);
      leaf.sizeInParent = data.size || 50;
      leaf.parent = parent;
      return leaf;
    }
    const node = new SplitNode(data.direction);
    node.parent = parent;
    for (const childData of data.children) {
      const child = SplitViewTree._deserializeNode(childData, node);
      node.children.push(child);
    }
    return node;
  }

  findLeaf(tabId, node = this.root) {
    if (!node) return null;
    if (node.type === "leaf") return node.tabId === tabId ? node : null;
    for (const child of node.children) {
      const result = this.findLeaf(tabId, child);
      if (result) return result;
    }
    return null;
  }
}
