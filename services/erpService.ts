import { ParsedLine } from '../types';

export const erpService = {
  async syncJob(jobId: string, data: ParsedLine[]) {
    console.log(`Syncing job ${jobId} to ERP...`, data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true, erpJobId: `ERP-${Math.floor(Math.random() * 10000)}` };
  },

  async getInventoryStatus(itemNos: string[]) {
    // Simulate checking stock levels
    return itemNos.reduce((acc, itemNo) => {
      acc[itemNo] = {
        stock: Math.floor(Math.random() * 1000),
        onOrder: Math.floor(Math.random() * 100),
        nextDelivery: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      };
      return acc;
    }, {} as Record<string, any>);
  }
};
