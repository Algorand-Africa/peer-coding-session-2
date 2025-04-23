import { abimethod, assert, Asset, Contract, Global, GlobalState, gtxn, itxn, Txn, uint64 } from '@algorandfoundation/algorand-typescript'

export class AssetMarket extends Contract {
  // Asset ID
  listingAssetId = GlobalState<uint64>();

  // Unit Price
  unitPrice = GlobalState<uint64>();

  /**
   * Create Application method (set price while creating)
   */
  @abimethod()
  public createApplication(unitPrice: uint64) {
    assert(unitPrice > 0, 'Unit price must be greater than 0');

    this.unitPrice.value = unitPrice;
  }

  /**
   * Create Asset 
   */
  @abimethod()
  public createAsset(mbrTxn: gtxn.PaymentTxn): uint64 {
    assert(Txn.sender === Global.creatorAddress);
    assert(mbrTxn.amount >= 200_000, 'Minimum balance must be at least 0.2 algos');
    assert(mbrTxn.receiver === Global.currentApplicationAddress);

    const response = itxn.assetConfig({
      assetName: 'NAIJA',
      total: 1000,
      decimals: 0,
    }).submit();

    this.listingAssetId.value = response.createdAsset.id;

    return response.createdAsset.id;
  }

  /**
   * Update price - newPrice
   */
  @abimethod()
  public updatePrice(newPrice: uint64) {
    assert(newPrice > 0, 'Unit price must be greater than 0');
    assert(Txn.sender === Global.creatorAddress);

    this.unitPrice.value = newPrice;
  }

  /**
   * purchase asset - numberOfUnits
   */
  @abimethod()
  public purchaseAsset(paymentTxn: gtxn.PaymentTxn, numberOfUnits: uint64) {
    assert(this.listingAssetId.hasValue);
    assert(numberOfUnits * this.unitPrice.value === paymentTxn.amount);
    assert(Txn.sender.isOptedIn(Asset(this.listingAssetId.value)));
    assert(paymentTxn.receiver === Global.currentApplicationAddress);
    assert(paymentTxn.sender === Txn.sender);

    itxn.assetTransfer({
      xferAsset: this.listingAssetId.value,
      assetAmount: numberOfUnits,
      assetReceiver: Txn.sender,
    }).submit();
  }

  /**
   * Delete application method
   */
  @abimethod()
  public deleteApplication() {
    assert(Txn.sender === Global.creatorAddress);

    if (this.listingAssetId.hasValue) {
      assert(Txn.sender.isOptedIn(Asset(this.listingAssetId.value)));

      const assetBalance = Asset(this.listingAssetId.value).balance(Global.currentApplicationAddress);

      itxn.assetTransfer({
        xferAsset: this.listingAssetId.value,
        assetAmount: assetBalance,
        assetReceiver: Global.creatorAddress,
      }).submit();
    }

    const algoBalance: uint64 = Global.currentApplicationAddress.balance - 200_000;

    itxn.payment({
      receiver: Global.creatorAddress,
      amount: algoBalance
    }).submit();
  }
}
