export const VERIFICATION_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordVerification",
    inputs: [
      { name: "recordHash", type: "bytes32" },
      { name: "ipfsCid", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getVerification",
    inputs: [{ name: "recordHash", type: "bytes32" }],
    outputs: [
      { name: "recordHash", type: "bytes32" },
      { name: "ipfsCid", type: "string" },
      { name: "timestamp", type: "uint64" },
      { name: "submitter", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "records",
    inputs: [{ name: "recordHash", type: "bytes32" }],
    outputs: [
      { name: "recordHash", type: "bytes32" },
      { name: "ipfsCid", type: "string" },
      { name: "timestamp", type: "uint64" },
      { name: "submitter", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "VerificationRecorded",
    inputs: [
      { name: "recordHash", type: "bytes32", indexed: true },
      { name: "ipfsCid", type: "string", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
      { name: "submitter", type: "address", indexed: true },
    ],
    anonymous: false,
  },
] as const;
