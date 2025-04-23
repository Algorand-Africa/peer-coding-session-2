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
  const account = client.account.fromMnemonic();

  return account;
}

async function deploySmartContract() {
  const account = await loadAccount();
  const client = await loadClient();

  const appFactory = client.client.getAppFactory({
    appSpec: JSON.stringify(SMART_CONTRACT_ARC_32),
    defaultSender: account.addr,
    defaultSigner: account.signer,
  });

  const response = await appFactory.send.create({
    method: "createApplication",
  });

  return {
    appId: response.result.appId,
    appAddress: response.result.appAddress,
  };
}

async function fundSmartContract(appAddress: string) {
  const account = await loadAccount();
  const client = await loadClient();

  const suggestedParams = await client.client.algod.getTransactionParams().do();

  const fundTxn = makePaymentTxnWithSuggestedParamsFromObject({
    amount: 200_000,
    from: account.addr,
    to: appAddress,
    suggestedParams,
  });

  const atc = new algosdk.AtomicTransactionComposer();

  atc.addTransaction({ txn: fundTxn, signer: account.signer });

  const response = await atc.execute(client.client.algod, 8);
  console.log(response);
}

async function main() {
  console.log("deploying...");
  const { appAddress, appId } = await deploySmartContract();
  console.log("deployment successful", appId, appAddress);

  console.log("Funding...");
  await fundSmartContract(appAddress);
  console.log("Funding successful");
}

main();
