import algosdk, {
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
} from "algosdk";
import * as algokit from "@algorandfoundation/algokit-utils";
import { SMART_CONTRACT_ARC_32 } from "./client";
import { AppClient } from "@algorandfoundation/algokit-utils/types/app-client";

async function loadClient() {
  const client = algokit.AlgorandClient.fromConfig({
    algodConfig: {
      server: "https://testnet-api.algonode.cloud",
    },
    indexerConfig: {
      server: "https://testnet-idx.algonode.cloud",
    },
  });

  return client;
}

async function loadAccount() {
  const client = await loadClient();
  const account = client.account.fromMnemonic('armor about monster prefer rice medal rule squirrel wire pigeon shell crop talent cheese spawn gas fit wagon erupt truck oppose pattern plate absent evoke');

  return account;
}

async function deploySmartContract(unitPrice: number) {
  const account = await loadAccount();
  const client = await loadClient();

  const appFactory = client.client.getAppFactory({
    appSpec: JSON.stringify(SMART_CONTRACT_ARC_32),
    defaultSender: account.addr,
    defaultSigner: account.signer,
  });

  const response = await appFactory.send.create({
    method: "createApplication",
    args: [unitPrice],
  });

  return {
    appId: response.result.appId,
    appAddress: response.result.appAddress,
  };
}

async function createAsset(appAddress: string, appId: number) {
  const account = await loadAccount();
  const client = await loadClient();

  const appClient = new AppClient({
    appId: BigInt(appId),
    algorand: client,
    appSpec: JSON.stringify(SMART_CONTRACT_ARC_32),
  })

  const suggestedParams = await client.client.algod.getTransactionParams().do();

  const mbrTxn = makePaymentTxnWithSuggestedParamsFromObject({
    amount: 200_000,
    from: account.addr,
    to: appAddress,
    suggestedParams,
  });

  const atc = new algosdk.AtomicTransactionComposer();

  atc.addMethodCall({
    appID: Number(appId),
    signer: account.signer,
    method: appClient.getABIMethod('createAsset'),
    suggestedParams: {
      ...suggestedParams,
      fee: 2_000,
      flatFee: true,
    },
    sender: account.addr,
    methodArgs: [{ txn: mbrTxn, signer: account.signer }],
  })

  const response = await atc.execute(client.client.algod, 8);

  return response.methodResults?.[0].returnValue;
}

async function purchaseAsset(
  appAddress: string, 
  appId: number, 
  numberOfUnits: number,
  price: number,
  assetId: number,
) {
  const account = await loadAccount();
  const client = await loadClient();

  const appClient = new AppClient({
    appId: BigInt(appId),
    algorand: client,
    appSpec: JSON.stringify(SMART_CONTRACT_ARC_32),
  })

  const suggestedParams = await client.client.algod.getTransactionParams().do();

  const payTxn = makePaymentTxnWithSuggestedParamsFromObject({
    amount: numberOfUnits * price,
    from: account.addr,
    to: appAddress,
    suggestedParams,
  });

  const optInTxn = makeAssetTransferTxnWithSuggestedParamsFromObject({
    amount: 0,
    from: account.addr,
    to: account.addr,
    suggestedParams,
    assetIndex: assetId,
  })

  const atc = new algosdk.AtomicTransactionComposer();

  atc.addTransaction({
    txn: optInTxn,
    signer: account.signer,
  })

  atc.addMethodCall({
    appID: Number(appId),
    signer: account.signer,
    method: appClient.getABIMethod('purchaseAsset'),
    appForeignAssets: [assetId],
    suggestedParams: {
      ...suggestedParams,
      fee: 2_000,
      flatFee: true,
    },
    sender: account.addr,
    methodArgs: [{ txn: payTxn, signer: account.signer }, numberOfUnits],
  })

  const response = await atc.execute(client.client.algod, 8);

  console.log(response);
}

async function main() {
  console.log("deploying...");
  const { appAddress, appId } = await deploySmartContract(35);
  console.log("deployment successful", appId, appAddress);

  console.log("minting NFT")
  const assetId = await createAsset(appAddress, Number(appId));
  console.log("Successfully minted NFT: ASAID = ", assetId);

  console.log('purchasing NFT')
  purchaseAsset(appAddress, Number(appId), 10, 35, Number(assetId));
}

main();
