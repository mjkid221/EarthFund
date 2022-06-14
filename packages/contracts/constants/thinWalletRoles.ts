import { ethers } from "hardhat";
const { keccak256, toUtf8Bytes, getAddress } = ethers.utils;

const roleHash = (role: string): string => keccak256(toUtf8Bytes(role));

export const TRANSFER_ADMIN = roleHash("TRANSFER_ADMIN");
export const TRANSFER = roleHash("TRANSFER");
export const DEFAULT_ADMIN_ROLE = roleHash("DEFAULT_ADMIN_ROLE");

/**
 * Generates the error message string for OpenZeppelin's AccessControlEnumerableUpgradeable contract. Used for testing purposes - pass the address of invalid caller along with role you are testing.
 * @param address The address of the invalid caller.
 * @param role The role that is being violated.
 * @returns A string representing the error message that the caller will receive.
 */
export const accessControlErr = (address: string, role: string): string =>
  `AccessControl: account ${getAddress(
    address
  ).toLowerCase()} is missing role ${role}`;
