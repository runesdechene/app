import fs from 'fs';
import path from 'path';

import {
  ImageCompressor,
  OptionsBuilder,
} from '../../../../../src/app/libs/media/image-compressor.js';
import { ImageBuilder } from '../../../../../src/app/libs/media/image-builder.js';

const fixturesPath = path.resolve(__dirname, '../../../../fixtures');

describe('Class: ImageCompressor', () => {
  it('should compress a wide image', async () => {
    const imagePath = path.resolve(fixturesPath, 'wide_image.jpg');

    const buffer = fs.readFileSync(imagePath);
    const image = await new ImageBuilder()
      .fromBuffer(buffer)
      .named('myfile.jpg')
      .build();

    expect(image.props.width).toBe(3888);
    expect(image.props.height).toBe(2592);

    const options = new OptionsBuilder()
      .png('small', 200)
      .webp('small', 200)
      .build();

    const compressor = new ImageCompressor();
    const result = await compressor.compress(image, options);

    expect(result.images.length).toBe(2);
    expect(result.images[0].variant).toEqual('small');
    expect(result.images[0].format).toEqual('png');
    expect(result.images[0].image.props.name).toBe('myfile_small.png');
    expect(result.images[0].image.props.format).toBe('png');
    expect(result.images[0].image.props.width).toBe(200);
    expect(result.images[0].image.props.height).toBe(133);
    expect(result.images[0].image.props.weight.toInt()).toBeLessThan(100_000);

    expect(result.images[1].variant).toEqual('small');
    expect(result.images[1].format).toEqual('webp');
    expect(result.images[1].image.props.name).toBe('myfile_small.webp');
    expect(result.images[1].image.props.format).toBe('webp');
    expect(result.images[1].image.props.width).toBe(200);
    expect(result.images[1].image.props.height).toBe(133);
    expect(result.images[1].image.props.weight.toInt()).toBeLessThan(10_000);
  });

  it('should compress a tall image', async () => {
    const imagePath = path.resolve(fixturesPath, 'tall_image.jpg');

    const buffer = fs.readFileSync(imagePath);
    const image = await new ImageBuilder()
      .fromBuffer(buffer)
      .named('myfile.jpg')
      .build();

    expect(image.props.width).toBe(2001);
    expect(image.props.height).toBe(3000);

    const options = new OptionsBuilder()
      .png('small', 200)
      .webp('small', 200)
      .build();

    const compressor = new ImageCompressor();
    const result = await compressor.compress(image, options);

    expect(result.images.length).toBe(2);
    expect(result.images[0].image.props.name).toBe('myfile_small.png');
    expect(result.images[0].image.props.format).toBe('png');
    expect(result.images[0].image.props.width).toBe(133);
    expect(result.images[0].image.props.height).toBe(200);
    expect(result.images[0].image.props.weight.toInt()).toBeLessThan(100_000);

    expect(result.images[1].image.props.name).toBe('myfile_small.webp');
    expect(result.images[1].image.props.format).toBe('webp');
    expect(result.images[1].image.props.width).toBe(133);
    expect(result.images[1].image.props.height).toBe(200);
    expect(result.images[1].image.props.weight.toInt()).toBeLessThan(10_000);
  });

  it('should compress a square image', async () => {
    const imagePath = path.resolve(fixturesPath, 'square_image.png');

    const buffer = fs.readFileSync(imagePath);
    const image = await new ImageBuilder()
      .fromBuffer(buffer)
      .named('myfile.jpg')
      .build();

    expect(image.props.width).toBe(1200);
    expect(image.props.height).toBe(1200);

    const options = new OptionsBuilder()
      .png('small', 200)
      .webp('small', 200)
      .build();

    const compressor = new ImageCompressor();
    const result = await compressor.compress(image, options);

    expect(result.images.length).toBe(2);
    expect(result.images[0].image.props.name).toBe('myfile_small.png');
    expect(result.images[0].image.props.format).toBe('png');
    expect(result.images[0].image.props.width).toBe(200);
    expect(result.images[0].image.props.height).toBe(200);
    expect(result.images[0].image.props.weight.toInt()).toBeLessThan(50_000);

    expect(result.images[1].image.props.name).toBe('myfile_small.webp');
    expect(result.images[1].image.props.format).toBe('webp');
    expect(result.images[1].image.props.width).toBe(200);
    expect(result.images[1].image.props.height).toBe(200);
    expect(result.images[1].image.props.weight.toInt()).toBeLessThan(5_000);
  });
});
