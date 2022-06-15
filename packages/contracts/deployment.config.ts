export default {
    childDaoConfig: {
        chainId: 31337,
        owners: ["0xB300ecae675213d6889d93c0Bf0B27DD04d8eaa0"],
        tokenName: "Test",
        tokenSymbol: "TEST",
        snapshotKey: "test-snapshot-key",
        snapshotValue: "test-snapshot-value",
        subdomain: "test-subdomain",
        safeThreshold: 1, // NOTE: must be less than or equal to the number of owners, will throw error in script if owners array length is less
    }
}
