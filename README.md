# jeff

Jeff converts Flash™ SWFs into a JSON/PNG format for high performance usage in HTML/JavaScript.
The extracted content could be used to integrate Flash™ Animations in your game using your favorite HTML Game Engine.

Contains a variety of options to allow you to get performance where you need it:

Optimised speed performance:

- Asset rasterisation (faster than vectorial drawing)
- Image Atlas creation (to enable batch sprite rendering in WebGL)
- Extracting images with power of 2 dimensions (to enable mipmapping)

Optimised memory performance:

- Image compression (lossy and loss-less compressions)
- Animation Scaling (to rasterise images at the exact size needed)

Optimised ease of use:

- Gathering several animations in a single output: Reduced number of assets to manage
- Frame by Frame rasterisation: for easy integration in your game

Very good scalability: from both the command line as well as through the API, it can be used to do batch extraction on multiple SWFs.

Made at [Wizcorp](http://www.wizcorp.jp).

## Install

```shell
git clone git@github.com:Lounek09/Jeff.git
cd Jeff
bun install
bun link
```

## Usage

```shell
jeff -h
jeff -s mySwf.swf
```

### Operation

* Will parse the input directory to find SWF files corresponding to the given source file pattern.
* Will sequentially parse and process the SWF files.
* Will export JSON meta-data and images corresponding to the SWF files.

For contributors, see [SWF File Format Specifications](http://wwwimages.adobe.com/www.adobe.com/content/dam/Adobe/en/devnet/swf/pdf/swf-file-format-spec.pdf)
