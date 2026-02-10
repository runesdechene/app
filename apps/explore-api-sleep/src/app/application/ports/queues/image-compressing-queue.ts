export const I_IMAGE_COMPRESSING_QUEUE = Symbol('I_IMAGE_COMPRESSING_QUEUE');

export interface IImageCompressingQueue {
  enqueue(imageId: string): Promise<void>;
}
