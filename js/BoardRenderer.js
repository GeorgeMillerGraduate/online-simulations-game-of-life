/**
 * BoardRenderer
 *
 * Handles all visual rendering and mouse interaction for the
 * Conway's Game of Life board.
 *
 * The GameOfLife class remains responsible for the actual simulation.
 */
class BoardRenderer {

    constructor(canvas, game) {

        this.canvas = canvas;
        this.context = canvas.getContext("2d");

        this.game = game;

        this.cellWidth = canvas.width / game.columns;
        this.cellHeight = canvas.height / game.rows;

        this.isDrawing = false;
        this.drawState = true;

        this.showGrid = true;

        // Colours
        this.backgroundColor = "#050708";
        this.cellColor = "#52e0b5";
        this.gridColor = "#162025";

        this.setupMouseEvents();

        this.render();
    }


    /**
     * Draw the complete board.
     */
    render() {

        this.clearCanvas();
        this.drawCells();

        if (this.showGrid) {
            this.drawGrid();
        }
    }


    /**
     * Clear the canvas.
     */
    clearCanvas() {

        this.context.fillStyle = this.backgroundColor;

        this.context.fillRect(
            0,
            0,
            this.canvas.width,
            this.canvas.height
        );
    }


    /**
     * Draw every living cell.
     */
    drawCells() {

        this.context.fillStyle = this.cellColor;

        for (let row = 0; row < this.game.rows; row++) {

            for (let column = 0; column < this.game.columns; column++) {

                if (this.game.isCellAlive(column, row)) {

                    this.drawCell(column, row);
                }
            }
        }
    }


    /**
     * Draw one living cell.
     */
    drawCell(column, row) {

        const x = column * this.cellWidth;
        const y = row * this.cellHeight;

        this.context.fillRect(
            x,
            y,
            this.cellWidth,
            this.cellHeight
        );
    }


    /**
     * Draw grid lines over the simulation.
     */
    drawGrid() {

        const context = this.context;

        context.beginPath();

        context.strokeStyle = this.gridColor;
        context.lineWidth = 1;


        // Vertical lines

        for (let column = 0; column <= this.game.columns; column++) {

            const x = Math.round(column * this.cellWidth) + 0.5;

            context.moveTo(x, 0);
            context.lineTo(x, this.canvas.height);
        }


        // Horizontal lines

        for (let row = 0; row <= this.game.rows; row++) {

            const y = Math.round(row * this.cellHeight) + 0.5;

            context.moveTo(0, y);
            context.lineTo(this.canvas.width, y);
        }


        context.stroke();
    }


    /**
     * Convert mouse coordinates into grid coordinates.
     */
    getCellFromMouse(event) {

        const rect = this.canvas.getBoundingClientRect();

        /*
         * Canvas CSS dimensions may differ from the canvas'
         * internal pixel dimensions.
         */

        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const mouseX =
            (event.clientX - rect.left) * scaleX;

        const mouseY =
            (event.clientY - rect.top) * scaleY;


        const column = Math.floor(
            mouseX / this.cellWidth
        );

        const row = Math.floor(
            mouseY / this.cellHeight
        );


        return {
            column: column,
            row: row
        };
    }


    /**
     * Check whether a coordinate exists on the board.
     */
    isInsideBoard(column, row) {

        return (
            column >= 0 &&
            column < this.game.columns &&
            row >= 0 &&
            row < this.game.rows
        );
    }


    /**
     * Configure mouse drawing.
     */
    setupMouseEvents() {

        const renderer = this;


        /*
         * Mouse pressed:
         *
         * Clicking a dead cell starts drawing living cells.
         * Clicking a living cell starts erasing cells.
         */

        $(this.canvas).on("mousedown", function(event) {

            const cell =
                renderer.getCellFromMouse(event);

            if (!renderer.isInsideBoard(
                cell.column,
                cell.row
            )) {
                return;
            }


            renderer.isDrawing = true;


            // Decide whether this drag draws or erases.

            renderer.drawState =
                !renderer.game.isCellAlive(
                    cell.column,
                    cell.row
                );


            renderer.game.setCell(
                cell.column,
                cell.row,
                renderer.drawState
            );


            renderer.render();
        });


        /*
         * Mouse moved while pressed.
         */

        $(this.canvas).on("mousemove", function(event) {

            if (!renderer.isDrawing) {
                return;
            }


            const cell =
                renderer.getCellFromMouse(event);


            if (!renderer.isInsideBoard(
                cell.column,
                cell.row
            )) {
                return;
            }


            renderer.game.setCell(
                cell.column,
                cell.row,
                renderer.drawState
            );


            renderer.render();
        });


        /*
         * Stop drawing.
         */

        $(window).on("mouseup", function() {

            renderer.isDrawing = false;
        });


        /*
         * Prevent browser drag behaviour.
         */

        $(this.canvas).on("dragstart", function(event) {

            event.preventDefault();
        });
    }


    /**
     * Enable/disable grid rendering.
     */
    setGridVisible(visible) {

        this.showGrid = visible;

        this.render();
    }


    /**
     * Recalculate cell dimensions.
     *
     * Useful if we later allow the Game of Life board
     * dimensions to change.
     */
    resize() {

        this.cellWidth =
            this.canvas.width / this.game.columns;

        this.cellHeight =
            this.canvas.height / this.game.rows;

        this.render();
    }
}