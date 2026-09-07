// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VerificationRegistry — tamper-evident anchor for HH Goa verification records
/// @notice Stores recordHash + IPFS CID + timestamp. No sensitive biometric data on-chain.
contract VerificationRegistry {
    struct Verification {
        bytes32 recordHash;
        string ipfsCid;
        uint64 timestamp;
        address submitter;
    }

    mapping(bytes32 => Verification) public records;

    event VerificationRecorded(
        bytes32 indexed recordHash,
        string ipfsCid,
        uint64 timestamp,
        address indexed submitter
    );

    /// @notice Anchor a verification record. Reverts if recordHash already exists or CID empty.
    function recordVerification(bytes32 recordHash, string calldata ipfsCid) external {
        require(bytes(ipfsCid).length > 0, "Empty IPFS CID");
        require(records[recordHash].timestamp == 0, "Already recorded");

        records[recordHash] = Verification({
            recordHash: recordHash,
            ipfsCid: ipfsCid,
            timestamp: uint64(block.timestamp),
            submitter: msg.sender
        });

        emit VerificationRecorded(recordHash, ipfsCid, uint64(block.timestamp), msg.sender);
    }

    /// @notice Read back a stored verification by record hash
    function getVerification(bytes32 recordHash)
        external
        view
        returns (bytes32, string memory, uint64, address)
    {
        Verification memory v = records[recordHash];
        require(v.timestamp != 0, "Not found");
        return (v.recordHash, v.ipfsCid, v.timestamp, v.submitter);
    }
}
