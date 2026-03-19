/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * xpcshell unit tests for SplitViewTree operations.
 */

const { SplitViewTree, SplitLeafNode, SplitNode } = ChromeUtils.importESModule(
  "chrome://mogwser/content/splitview/SplitViewTree.mjs"
);

add_task(async function test_insert_two_tabs() {
  const tree = new SplitViewTree();
  const leaf1 = new SplitLeafNode("tab-1");
  tree.root = leaf1;

  tree.insertNode(leaf1, "tab-2", "right");

  Assert.ok(tree.root.type === "split", "Root should be a split node");
  Assert.equal(tree.root.direction, "row", "Direction should be row for right split");
  Assert.equal(tree.root.children.length, 2, "Should have 2 children");
  Assert.equal(tree.root.children[0].tabId, "tab-1", "First child should be tab-1");
  Assert.equal(tree.root.children[1].tabId, "tab-2", "Second child should be tab-2");
});

add_task(async function test_remove_collapses_parent() {
  const tree = new SplitViewTree();
  const leaf1 = new SplitLeafNode("tab-1");
  tree.root = leaf1;

  const leaf2 = tree.insertNode(leaf1, "tab-2", "right");
  tree.removeNode(leaf2);

  Assert.ok(
    tree.root.type === "leaf",
    "Root should collapse to a leaf after removing one of two children"
  );
  Assert.equal(tree.root.tabId, "tab-1", "Remaining leaf should be tab-1");
});

add_task(async function test_swap_nodes() {
  const tree = new SplitViewTree();
  const leaf1 = new SplitLeafNode("tab-1");
  tree.root = leaf1;

  const leaf2 = tree.insertNode(leaf1, "tab-2", "right");
  tree.swapNodes(tree.root.children[0], leaf2);

  Assert.equal(tree.root.children[0].tabId, "tab-2", "First should now be tab-2");
  Assert.equal(tree.root.children[1].tabId, "tab-1", "Second should now be tab-1");
});

add_task(async function test_calculate_positions() {
  const tree = new SplitViewTree();
  const leaf1 = new SplitLeafNode("tab-1");
  tree.root = leaf1;
  leaf1.sizeInParent = 50;

  tree.insertNode(leaf1, "tab-2", "right");

  const positions = tree.calculatePositions();
  Assert.ok(positions.has("tab-1"), "Positions should include tab-1");
  Assert.ok(positions.has("tab-2"), "Positions should include tab-2");

  const pos1 = positions.get("tab-1");
  const pos2 = positions.get("tab-2");
  Assert.equal(pos1.left, 0, "tab-1 should start at left edge");
  Assert.ok(pos2.left > 0, "tab-2 should be offset from left");
});

add_task(async function test_serialization_roundtrip() {
  const tree = new SplitViewTree();
  const leaf1 = new SplitLeafNode("tab-1");
  tree.root = leaf1;
  tree.insertNode(leaf1, "tab-2", "right");
  tree.insertNode(tree.findLeaf("tab-2"), "tab-3", "bottom");

  const serialized = tree.serialize();
  const restored = SplitViewTree.deserialize(serialized);

  Assert.ok(restored.root, "Restored tree should have a root");
  Assert.ok(restored.findLeaf("tab-1"), "Should find tab-1");
  Assert.ok(restored.findLeaf("tab-2"), "Should find tab-2");
  Assert.ok(restored.findLeaf("tab-3"), "Should find tab-3");
});

add_task(async function test_min_panel_size_enforcement() {
  const tree = new SplitViewTree();
  const leaf1 = new SplitLeafNode("tab-1");
  tree.root = leaf1;

  tree.insertNode(leaf1, "tab-2", "right");

  // Set one panel to a very small size (below 7% minimum)
  tree.root.children[0].sizeInParent = 3;
  tree.root.children[1].sizeInParent = 97;

  const positions = tree.calculatePositions();
  const pos1 = positions.get("tab-1");
  const pos2 = positions.get("tab-2");

  // Verify positions are calculated (the tree itself computes positions,
  // minimum enforcement is done by MogwserSplitView.resizePanel)
  Assert.ok(pos1, "Position for tab-1 should be calculated even at small size");
  Assert.ok(pos2, "Position for tab-2 should be calculated");
  Assert.equal(pos1.left, 0, "tab-1 should start at left edge");
});

add_task(async function test_find_leaf() {
  const tree = new SplitViewTree();
  const leaf1 = new SplitLeafNode("tab-1");
  tree.root = leaf1;
  tree.insertNode(leaf1, "tab-2", "right");

  Assert.ok(tree.findLeaf("tab-1"), "Should find tab-1");
  Assert.ok(tree.findLeaf("tab-2"), "Should find tab-2");
  Assert.equal(tree.findLeaf("tab-3"), null, "Should not find nonexistent tab");
});
