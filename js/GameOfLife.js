/**
 * GameOfLife
 *
 * Stores the cellular grid and implements Conway's
 * Game of Life simulation rules.
 *
 * This class contains no rendering or UI code.
 */
class GameOfLife {

    constructor(columns = 90, rows = 60) {

        this.columns = columns;
        this.rows = rows;

        this.generation = 0;

        this.grid = this.createEmptyGrid();
    }


    /**
     * Create a completely empty board.
     */
    createEmptyGrid() {

        const grid = [];

        for (let row = 0; row < this.rows; row++) {

            const currentRow = [];

            for (let column = 0; column < this.columns; column++) {

                currentRow.push(false);
            }

            grid.push(currentRow);
        }

        return grid;
    }


    /**
     * Check whether coordinates exist on the board.
     */
    isInsideBoard(column, row) {

        return (
            column >= 0 &&
            column < this.columns &&
            row >= 0 &&
            row < this.rows
        );
    }


    /**
     * Return whether a cell is currently alive.
     */
    isCellAlive(column, row) {

        if (!this.isInsideBoard(column, row)) {
            return false;
        }

        return this.grid[row][column];
    }


    /**
     * Set a cell to alive or dead.
     */
    setCell(column, row, alive) {

        if (!this.isInsideBoard(column, row)) {
            return;
        }

        this.grid[row][column] = Boolean(alive);
    }


    /**
     * Toggle the state of a cell.
     */
    toggleCell(column, row) {

        if (!this.isInsideBoard(column, row)) {
            return;
        }

        this.grid[row][column] =
            !this.grid[row][column];
    }


    /**
     * Count the number of living neighbours surrounding
     * a particular cell.
     */
    countLivingNeighbours(column, row) {

        let count = 0;

        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {

            for (
                let columnOffset = -1;
                columnOffset <= 1;
                columnOffset++
            ) {

                // Ignore the cell itself.

                if (
                    columnOffset === 0 &&
                    rowOffset === 0
                ) {
                    continue;
                }


                const neighbourColumn =
                    column + columnOffset;

                const neighbourRow =
                    row + rowOffset;


                if (
                    this.isCellAlive(
                        neighbourColumn,
                        neighbourRow
                    )
                ) {
                    count++;
                }
            }
        }

        return count;
    }


    /**
     * Calculate one complete generation.
     *
     * Conway's rules:
     *
     * 1. A live cell with fewer than 2 neighbours dies.
     * 2. A live cell with 2 or 3 neighbours survives.
     * 3. A live cell with more than 3 neighbours dies.
     * 4. A dead cell with exactly 3 neighbours becomes alive.
     */
    step() {

        const nextGrid =
            this.createEmptyGrid();


        for (let row = 0; row < this.rows; row++) {

            for (
                let column = 0;
                column < this.columns;
                column++
            ) {

                const alive =
                    this.isCellAlive(column, row);

                const neighbours =
                    this.countLivingNeighbours(
                        column,
                        row
                    );


                /*
                 * Living cell
                 */

                if (alive) {

                    if (
                        neighbours === 2 ||
                        neighbours === 3
                    ) {

                        nextGrid[row][column] = true;
                    }

                }


                /*
                 * Dead cell
                 */

                else {

                    if (neighbours === 3) {

                        nextGrid[row][column] = true;
                    }
                }
            }
        }


        this.grid = nextGrid;

        this.generation++;
    }


    /**
     * Clear the entire board.
     */
    clear() {

        this.grid =
            this.createEmptyGrid();

        this.generation = 0;
    }


    /**
     * Fill the board with random cells.
     *
     * density:
     * 0.0 = completely empty
     * 1.0 = completely full
     */
    randomise(density = 0.25) {

        density = Math.max(
            0,
            Math.min(1, density)
        );


        for (let row = 0; row < this.rows; row++) {

            for (
                let column = 0;
                column < this.columns;
                column++
            ) {

                this.grid[row][column] =
                    Math.random() < density;
            }
        }


        this.generation = 0;
    }


    /**
     * Count the total number of living cells.
     */
    getPopulation() {

        let population = 0;


        for (let row = 0; row < this.rows; row++) {

            for (
                let column = 0;
                column < this.columns;
                column++
            ) {

                if (this.grid[row][column]) {

                    population++;
                }
            }
        }


        return population;
    }


    /**
     * Return the current generation number.
     */
    getGeneration() {

        return this.generation;
    }


    /**
     * Load a pattern represented as a 2D boolean array.
     *
     * This will eventually be used by ImagePatternLoader.
     */
    loadPattern(
        pattern,
        startColumn = 0,
        startRow = 0,
        clearFirst = true
    ) {

        if (!Array.isArray(pattern)) {
            return;
        }


        if (clearFirst) {
            this.clear();
        }


        for (
            let patternRow = 0;
            patternRow < pattern.length;
            patternRow++
        ) {

            if (!Array.isArray(pattern[patternRow])) {
                continue;
            }


            for (
                let patternColumn = 0;
                patternColumn < pattern[patternRow].length;
                patternColumn++
            ) {

                if (!pattern[patternRow][patternColumn]) {
                    continue;
                }


                const boardColumn =
                    startColumn + patternColumn;

                const boardRow =
                    startRow + patternRow;


                this.setCell(
                    boardColumn,
                    boardRow,
                    true
                );
            }
        }
    }


    /**
     * Load a pattern into the centre of the board.
     */
    loadPatternCentered(pattern, clearFirst = true) {

        if (
            !Array.isArray(pattern) ||
            pattern.length === 0
        ) {
            return;
        }


        const patternHeight =
            pattern.length;

        const patternWidth =
            Math.max(
                ...pattern.map(row =>
                    Array.isArray(row)
                        ? row.length
                        : 0
                )
            );


        const startColumn =
            Math.floor(
                (this.columns - patternWidth) / 2
            );

        const startRow =
            Math.floor(
                (this.rows - patternHeight) / 2
            );


        this.loadPattern(
            pattern,
            startColumn,
            startRow,
            clearFirst
        );
    }
}