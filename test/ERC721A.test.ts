import { ethers } from "hardhat";
import { expect } from 'chai';
import { constants } from  "@openzeppelin/test-helpers";

import "@nomiclabs/hardhat-ethers";

import { NFT, NFT__factory } from "../typechain";

import { getCurrentTimestamp, deployContract } from "./helpers";
const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");
const Web3 = require("web3");

const web3 = new Web3();
const { ZERO_ADDRESS } = constants;
const { parseEther, formatEther } = ethers.utils;
const RECEIVER_MAGIC_VALUE = "0x150b7a02";
const GAS_MAGIC_VALUE = 20000;

let ERC721AFactory: NFT__factory;
let erc721a: NFT;


const createTestSuite = ({ contract, constructorArgs }) =>
    function () {
        context(`${contract}`, function () {
            before(async () => {
                ERC721AFactory = await ethers.getContractFactory(contract) as NFT__factory;
            });

            beforeEach(async function () {
                erc721a = await ERC721AFactory.deploy(constructorArgs);
                await erc721a.deployed();
                this.receiver = await deployContract("ERC721ReceiverMock", [RECEIVER_MAGIC_VALUE]);
                const [owner, signer, addr1, addr2] = await ethers.getSigners();
                this.owner = owner;
                this.addr1 = addr1;
                this.addr2 = addr2;
                this.signer = signer;
            });

            context("with no minted tokens", async function () {
                it("has 0 totalSupply", async function () {
                    const supply = await erc721a.totalSupply();
                    expect(supply).to.equal(0);
                });

                it("has 0 totalMinted", async function () {
                    const totalMinted = await erc721a.totalMinted();
                    expect(totalMinted).to.equal(0);
                });
            });

            context("ownership", async function() {
                it("default", async function() {
                    expect(await erc721a.owner()).to.be.equal(this.owner.address);
                });

                it("change", async function() {
                    await erc721a.transferOwnership(this.addr1.address);
                    await expect(erc721a.transferOwnership(this.addr1.address)).to.be.reverted;
                    expect(await erc721a.owner()).to.be.equal(this.addr1.address);
                });
            });

            context("reserve", async function () {
                it("in valid range and batch size", async function () {
                    expect(await erc721a.balanceOf(this.owner.address)).to.equal("0");
                    expect(await erc721a.totalMinted()).to.equal("0");
                    await erc721a.reserve(5);
                    expect(await erc721a.balanceOf(this.owner.address)).to.equal("5");
                    expect(await erc721a.totalMinted()).to.equal("5");
                    await erc721a.reserve(10);
                    expect(await erc721a.balanceOf(this.owner.address)).to.equal("15");
                    expect(await erc721a.totalMinted()).to.equal("15");
                });

                it("in valid range, but with wrong batch size", async function () {
                    await expect(erc721a.reserve(6)).to.be.revertedWith('can only mint a multiple of the maxBatchSize');
                    expect(await erc721a.balanceOf(this.owner.address)).to.equal("0");
                    expect(await erc721a.totalMinted()).to.equal("0");

                });

                it("from wrong user", async function () {
                    await erc721a.reserve(20);
                    expect(await erc721a.balanceOf(this.owner.address)).to.equal("20");

                });

                it("transfer to another user", async function () {
                    await erc721a.reserve(5);
                    await erc721a.connect(this.owner).setApprovalForAll(this.addr1.address, true);
                    expect(await erc721a.balanceOf(this.owner.address)).to.equal("5");
                    expect(await erc721a.ownerOf("1")).to.equal(this.owner.address);
                    this.transferTx = await erc721a.connect(this.addr1).transferFrom(this.owner.address, this.addr1.address, 1);
                    expect(await erc721a.balanceOf(this.owner.address)).to.equal("4");
                    expect(await erc721a.ownerOf("1")).to.equal(this.addr1.address);
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("1");
                });
            });

            context("Whitelist sale", async function () {
                beforeEach(async function () {
                    let currentTime = await getCurrentTimestamp();
                    await erc721a.setConfig(
                        currentTime,
                        parseEther("10.0"),
                        50,
                        parseEther("2.0"),
                        2,
                    );
                    let addresses = [
                      {
                        addr: web3.eth.abi.encodeParameter("uint256", this.addr1.address.toLowerCase()),
                        chainId: web3.eth.abi.encodeParameter("uint256", "1337"),
                      },
                    ];
                    console.log(addresses);
                    const leafNodes = addresses.map((item) =>
                      keccak256(
                        Buffer.concat([
                          Buffer.from(item.addr.replace("0x", ""), "hex"),
                          Buffer.from(item.chainId.replace("0x", ""), "hex"),
                        ])
                      )
                    );
                    console.log(
                        Buffer.concat([
                          Buffer.from(addresses[0].addr.replace("0x", ""), "hex"),
                          Buffer.from(addresses[0].chainId.replace("0x", ""), "hex"),
                        ])
                    );
                    console.log(leafNodes);

                    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
                    this.merkleProof = merkleTree.getHexProof(leafNodes[0]);
                    await erc721a.setRoot(merkleTree.getHexRoot());
                });

                it("enough money", async function () {
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                    await erc721a.connect(this.addr1).whitelistMint(this.merkleProof, 2, {value: parseEther("4.0")});
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("2");
                });

                it("wrong proof", async function () {
                    expect(await erc721a.balanceOf(this.addr2.address)).to.equal("0");
                    await expect(
                        erc721a.connect(this.addr2).whitelistMint(this.merkleProof, 2, {value: parseEther("4.0")})
                    ).to.be.revertedWith('Whitelist is wrong');
                    expect(await erc721a.balanceOf(this.addr2.address)).to.equal("0");
                });

                it("too much #1", async function () {
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                    await erc721a.connect(this.addr1).whitelistMint(this.merkleProof, 1, {value: parseEther("4.0")});
                    await expect(
                        erc721a.connect(this.addr1).whitelistMint(this.merkleProof, 2, {value: parseEther("3.0")})
                    ).to.be.revertedWith('can not mint this many');
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("1");
                });

                it("too much #2", async function () {
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                    await expect(
                        erc721a.connect(this.addr1).whitelistMint(this.merkleProof, 3, {value: parseEther("3.0")})
                    ).to.be.revertedWith('can not mint this many');
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                });

                it("not enough money", async function () {
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                    await expect(
                        erc721a.connect(this.addr1).whitelistMint(this.merkleProof, 2, {value: parseEther("3.0")})
                    ).to.be.revertedWith('Need to send more ETH.');
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                });

                it("get change", async function () {
                    await erc721a.connect(this.addr1).whitelistMint(this.merkleProof, 2, {value: parseEther("6.0")});
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("2");
                });

                it("withdraw accumulated", async function () {
                    await erc721a.connect(this.addr1).whitelistMint(this.merkleProof, 2, {value: parseEther("6.0")});
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("2");
                });
            });
            context("Public sale", async function () {
                beforeEach(async function () {
                    let currentTime = await getCurrentTimestamp();
                    await erc721a.setConfig(
                        currentTime,
                        parseEther("2.0"),
                        50,
                        parseEther("1.0"),
                        2,
                    );
                });

                it("enough money", async function () {
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                    await erc721a.connect(this.addr1).mint(2, {value: parseEther("4.0")});
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("2");
                });

                it("not enough money", async function () {
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                    await expect(
                        erc721a.connect(this.addr1).mint(2, {value: parseEther("3.0")})
                    ).to.be.revertedWith('Need to send more ETH.');
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("0");
                });

                it("get change", async function () {
                    await erc721a.connect(this.addr1).mint(2, {value: parseEther("5.0")});
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("2");
                });

                it("withdraw accumulated", async function () {
                    await erc721a.connect(this.addr1).mint(2, {value: parseEther("5.0")});
                    expect(await erc721a.balanceOf(this.addr1.address)).to.equal("2");
                });

                it("change sale start date", async function () {
                    let currentTime = await getCurrentTimestamp();

                    await erc721a.connect(this.addr1).mint(1, {value: parseEther("5.0")});
                    await erc721a.setConfig(
                        currentTime + 60,
                        parseEther("2.0"),
                        50,
                        parseEther("1.0"),
                        2,
                    );
                    await expect(
                        erc721a.connect(this.addr1).mint(
                            2,
                            {value: parseEther("5.0")}
                        )
                    ).to.be.revertedWith('sale has not begun yet');
                });
            });
        });
    };

describe("ERC721A", createTestSuite({ contract: "NFT", constructorArgs: []}));

