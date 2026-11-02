/**
 * ImagePatternLoader
 *
 * Converts uploaded PNG images into Game of Life patterns.
 *
 * Bright pixels -> living cells
 * Dark pixels   -> dead cells
 *
 * The threshold and inversion can be changed by the user.
 */
class ImagePatternLoader {

    constructor(canvas) {

        this.canvas = canvas;
        this.context = canvas.getContext(
            "2d",
            {
                willReadFrequently: true
            }
        );

        this.image = null;

        this.fileName = null;
    }


    /**
     * Load an image from a File object.
     *
     * Returns a Promise so app.js can wait until
     * the image has completely loaded.
     */
    loadFile(file) {

        return new Promise((resolve, reject) => {

            if (!file) {

                reject(
                    new Error("No image file selected.")
                );

                return;
            }


            if (file.type !== "image/png") {

                reject(
                    new Error(
                        "Only PNG images are supported."
                    )
                );

                return;
            }


            const reader =
                new FileReader();


            reader.onload = (event) => {

                const image =
                    new Image();


                image.onload = () => {

                    this.image = image;

                    this.fileName =
                        file.name;

                    resolve(image);
                };


                image.onerror = () => {

                    reject(
                        new Error(
                            "The PNG image could not be loaded."
                        )
                    );
                };


                image.src =
                    event.target.result;
            };


            reader.onerror = () => {

                reject(
                    new Error(
                        "The selected file could not be read."
                    )
                );
            };


            reader.readAsDataURL(file);
        });
    }


    /**
     * Check whether an image has been loaded.
     */
    hasImage() {

        return this.image !== null;
    }


    /**
     * Convert the loaded image into a boolean Game of Life
     * pattern.
     *
     * targetWidth  = number of Game of Life columns
     * targetHeight = number of Game of Life rows
     *
     * threshold:
     * 0   -> almost everything becomes alive
     * 255 -> only completely white pixels become alive
     *
     * invert:
     * false -> bright pixels are alive
     * true  -> dark pixels are alive
     */
    createPattern(
        targetWidth,
        targetHeight,
        threshold = 128,
        invert = false
    ) {

        if (!this.image) {

            throw new Error(
                "No image has been loaded."
            );
        }


        threshold =
            Math.max(
                0,
                Math.min(255, threshold)
            );


        /*
         * Calculate dimensions that preserve the
         * image's original aspect ratio.
         */

        const dimensions =
            this.calculateScaledDimensions(
                this.image.width,
                this.image.height,
                targetWidth,
                targetHeight
            );


        const width =
            dimensions.width;

        const height =
            dimensions.height;


        /*
         * Resize the hidden canvas.
         *
         * Each canvas pixel will eventually correspond
         * to one Game of Life cell.
         */

        this.canvas.width = width;
        this.canvas.height = height;


        /*
         * Clear anything from a previous conversion.
         */

        this.context.clearRect(
            0,
            0,
            width,
            height
        );


        /*
         * Draw the image at the reduced resolution.
         */

        this.context.drawImage(
            this.image,
            0,
            0,
            width,
            height
        );


        /*
         * Retrieve RGBA pixel data.
         */

        const imageData =
            this.context.getImageData(
                0,
                0,
                width,
                height
            );


        const pixels =
            imageData.data;


        const pattern = [];


        /*
         * Convert every image pixel into one boolean cell.
         */

        for (let y = 0; y < height; y++) {

            const row = [];


            for (let x = 0; x < width; x++) {

                const index =
                    (y * width + x) * 4;


                const red =
                    pixels[index];

                const green =
                    pixels[index + 1];

                const blue =
                    pixels[index + 2];

                const alpha =
                    pixels[index + 3];


                /*
                 * Calculate perceived brightness.
                 *
                 * Human vision is more sensitive to green
                 * than red and considerably more sensitive
                 * to red than blue.
                 */

                const brightness =
                    (0.2126 * red) +
                    (0.7152 * green) +
                    (0.0722 * blue);


                let alive;


                /*
                 * Completely transparent pixels are
                 * considered empty.
                 */

                if (alpha === 0) {

                    alive = false;

                } else {

                    alive =
                        brightness >= threshold;


                    if (invert) {

                        alive = !alive;
                    }
                }


                row.push(alive);
            }


            pattern.push(row);
        }


        return pattern;
    }


    /**
     * Calculate dimensions that fit inside the board
     * without distorting the image.
     */
    calculateScaledDimensions(
        sourceWidth,
        sourceHeight,
        maxWidth,
        maxHeight
    ) {

        if (
            sourceWidth <= 0 ||
            sourceHeight <= 0
        ) {

            return {
                width: 1,
                height: 1
            };
        }


        const widthRatio =
            maxWidth / sourceWidth;

        const heightRatio =
            maxHeight / sourceHeight;


        /*
         * Never enlarge an image beyond the board.
         *
         * Small images remain at their original
         * pixel dimensions.
         */

        const scale =
            Math.min(
                widthRatio,
                heightRatio,
                1
            );


        const width =
            Math.max(
                1,
                Math.floor(
                    sourceWidth * scale
                )
            );


        const height =
            Math.max(
                1,
                Math.floor(
                    sourceHeight * scale
                )
            );


        return {
            width: width,
            height: height
        };
    }


    /**
     * Return information about the currently loaded image.
     */
    getImageInfo() {

        if (!this.image) {

            return null;
        }


        return {

            fileName:
                this.fileName,

            width:
                this.image.width,

            height:
                this.image.height

        };
    }


    /**
     * Remove the currently loaded image.
     */
    clear() {

        this.image = null;
        this.fileName = null;


        this.context.clearRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
    }
}