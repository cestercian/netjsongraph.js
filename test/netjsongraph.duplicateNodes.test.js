const {operations, dealJSONData} = require("../src/js/netjsonWorker");
const {addFlatNodes, arrayDeduplication, addNodeLinks} = operations;
const {NetJSONGraphRender} = require("../src/js/netjsongraph.render");

// Test data for duplicate node handling
const duplicateNodeTestData = new Map([
  [
    // key: Simple network with duplicate node
    "duplicateNodeNetwork",
    // value: Test data
    {
      input: {
        nodes: [
          {
            id: "node1",
            label: "Node 1",
          },
          {
            id: "node1", // Duplicate ID
            label: "Node 1 Duplicate",
          },
          {
            id: "node2",
            label: "Node 2",
          },
        ],
        links: [
          {
            source: "node1",
            target: "node2",
          },
        ],
      },
      expected: {
        nodeCount: 2,
        linkCount: 1,
        flatNodeCount: 2,
        node1Count: 1,
      },
    },
  ],
  [
    // key: Data for mergeData test
    "mergeDataTest",
    // value: Test data
    {
      initialData: {
        nodes: [
          {
            id: "node1",
            label: "Node 1",
          },
          {
            id: "node2",
            label: "Node 2",
          },
        ],
        links: [
          {
            source: "node1",
            target: "node2",
          },
        ],
      },
      newData: {
        nodes: [
          {
            id: "node1", // Duplicate ID
            label: "Node 1 Updated",
          },
          {
            id: "node3", // New node
            label: "Node 3",
          },
        ],
        links: [
          {
            source: "node2",
            target: "node3",
          },
        ],
      },
      expected: {
        finalNodeCount: 3,
        finalLinkCount: 2,
        node1Count: 1,
        node3Count: 1,
      },
    },
  ],
  [
    // key: Data for addData deduplication test
    "addDataDeduplication",
    // value: Test data
    {
      corruptData: {
        nodes: [
          {
            id: "node1",
            label: "Node 1",
          },
          {
            id: "node1", // Duplicate ID (corrupt state)
            label: "Node 1 Duplicate",
          },
          {
            id: "node2",
            label: "Node 2",
          },
        ],
        links: [],
      },
      newData: {
        nodes: [],
        links: [],
      },
      expected: {
        finalNodeCount: 2,
        node1Count: 1,
      },
    },
  ],
]);

// Mock required dependencies
global.L = {
  circleMarker: jest.fn(),
  divIcon: jest.fn(),
  point: jest.fn(),
  markerClusterGroup: jest.fn(() => ({
    addTo: jest.fn(() => ({})),
    addLayer: jest.fn(),
  })),
  geoJSON: jest.fn(() => ({
    addTo: jest.fn(),
    removeFrom: jest.fn(),
  })),
};

global.echarts = {
  use: jest.fn(),
  init: jest.fn(),
  appendData: jest.fn(),
  setOption: jest.fn(),
  on: jest.fn(),
};

describe("NetJSONGraph Duplicate Node ID Handling", () => {
  // Test the enhanced dealJSONData function
  test("dealJSONData should handle duplicate node IDs gracefully", () => {
    // Get test data
    const testCase = duplicateNodeTestData.get("duplicateNodeNetwork");
    const testData = testCase.input;
    const expected = testCase.expected;

    // Process the data with our enhanced dealJSONData function
    const processedData = dealJSONData(testData);

    // Verify that only one node with ID "node1" was kept
    expect(
      processedData.nodes.filter((node) => node.id === "node1").length,
    ).toBe(expected.node1Count);

    // Verify the total count is correct (should be 2 nodes - node1 and node2)
    expect(processedData.nodes.length).toBe(expected.nodeCount);

    // Verify flatNodes contains the correct nodes
    expect(Object.keys(processedData.flatNodes).length).toBe(
      expected.flatNodeCount,
    );
    expect(processedData.flatNodes["node1"]).toBeDefined();
    expect(processedData.flatNodes["node2"]).toBeDefined();
  });

  // Test the enhanced mergeData function
  test("mergeData should handle duplicate node IDs correctly", () => {
    // Get test data
    const testCase = duplicateNodeTestData.get("mergeDataTest");
    const initialData = testCase.initialData;
    const newData = testCase.newData;
    const expected = testCase.expected;

    // Create an instance of NetJSONGraphRender
    const netJSONGraphRender = new NetJSONGraphRender();

    // Mock self object with initial data
    const self = {
      data: JSON.parse(JSON.stringify(initialData)),
    };

    // Call the mergeData function with our mock self and new data
    netJSONGraphRender.mergeData(newData, self);

    // Verify that the duplicate node was not added
    expect(self.data.nodes.filter((node) => node.id === "node1").length).toBe(
      expected.node1Count,
    );

    // Verify that the new node was added
    expect(self.data.nodes.filter((node) => node.id === "node3").length).toBe(
      expected.node3Count,
    );

    // Verify total node and link counts
    expect(self.data.nodes.length).toBe(expected.finalNodeCount);
    expect(self.data.links.length).toBe(expected.finalLinkCount);
  });

  // Test the addData function's safeguard
  test("addData should apply extra deduplication safeguard", () => {
    // Get test data
    const testCase = duplicateNodeTestData.get("addDataDeduplication");
    const corruptData = testCase.corruptData;
    const newData = testCase.newData;
    const expected = testCase.expected;

    // Create an instance of NetJSONGraphRender
    const netJSONGraphRender = new NetJSONGraphRender();

    // Mock the render function
    netJSONGraphRender.render = jest.fn();

    // Mock self object with corrupt initial data
    const self = {
      data: JSON.parse(JSON.stringify(corruptData)),
      utils: {
        mergeData: netJSONGraphRender.mergeData,
        render: jest.fn(),
      },
      config: {
        afterUpdate: jest.fn(),
      },
    };

    // Call the addData function with our mock self and new data
    netJSONGraphRender.addData(newData, self);

    // Verify that the duplicate node was removed by the safeguard
    expect(self.data.nodes.filter((node) => node.id === "node1").length).toBe(
      expected.node1Count,
    );

    // Verify total node count
    expect(self.data.nodes.length).toBe(expected.finalNodeCount);
  });
});
