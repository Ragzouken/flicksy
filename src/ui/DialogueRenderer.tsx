import { Font, parseFont } from "../text/font";
import { Page, PageRenderer, scriptToPages, Glyph } from "../text/text";
import { makeVector2 } from "../pixels/sprite";
import { SCALE_MODES, BaseTexture, Texture } from "pixi.js";
import { randomInt } from "../tools/utility";

export class DialogueRenderer
{
    public readonly canvas = document.createElement("canvas");
    public readonly texture: Texture;
    private readonly context = this.canvas.getContext("2d")!;

    private pageRenderer: PageRenderer = new PageRenderer(1, 1);

    private pageTime = 0;
    private showCharTime = .05;
    private showGlyphElapsed = 0;

    private queuedPages: Page[] = [];
    private currentPage: Page | undefined = undefined;
    private showGlyphCount = 0;
    private pageGlyphCount = 0;

    private font: Font = new Font("no font", 4, 4);

    public get empty() { return this.currentPage === undefined; }

    constructor(private arrow: CanvasImageSource,
                private square: CanvasImageSource)
    {
        const base = new BaseTexture(this.canvas, SCALE_MODES.NEAREST);
        this.texture = new Texture(base);
        this.setFont(this.font);

        fetch("./ascii_small.bitsyfont")
        .then(response => response.text())
        .then(source => parseFont(source))
        .then(font => this.setFont(font));
    }

    public setFont(font: Font): void
    {
        this.font = font;
        this.canvas.width = 208;
        this.canvas.height = (3 * 4) + this.font.charHeight * 2 + 15;

        this.pageRenderer = new PageRenderer(this.canvas.width,
                                             this.canvas.height);
    }

    private getCurrentGlyph(): Glyph | undefined
    {
        return this.currentPage ? this.currentPage[this.showGlyphCount] : undefined;
    }

    public update(dt: number): void
    {
        if (!this.currentPage)
            return;

        this.pageTime += dt;
        this.showGlyphElapsed += dt;

        this.applyStyle();

        while (this.showGlyphElapsed > this.showCharTime
            && this.showGlyphCount < this.pageGlyphCount)
        {
            this.showGlyphElapsed -= this.showCharTime;
            this.revealNextChar();
            this.applyStyle();
        }
    }

    public render(): void
    {
        if (!this.currentPage)
            return;

        this.pageRenderer.renderPage(this.currentPage, 8, 8);
        this.context.fillStyle = "#000000";
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(this.pageRenderer.pageImage, 0, 0);

        if (this.showGlyphCount === this.pageGlyphCount)
        {
            const prompt = this.queuedPages.length > 0 
                         ? this.arrow : this.square;
            this.context.drawImage(prompt, 
                                   this.canvas.width - 19, 
                                   this.canvas.height - 10);
        }
        this.texture.update();
    }

    public revealNextChar(): void
    {
        this.showGlyphCount = Math.min(this.showGlyphCount + 1, this.pageGlyphCount);
        
        if (!this.currentPage) return;

        for (let i = 0; i < this.currentPage.length; ++i)
        {
            if (i < this.showGlyphCount)
            {
                this.currentPage[i].hidden = false;
            }
        }
    }

    public cancel(): void
    {
        this.queuedPages.length = 0;
        this.currentPage = undefined;
    }

    public skip(): void
    {
        if (this.showGlyphCount === this.pageGlyphCount)
        {
            this.moveToNextPage();
        }
        else
        {
            this.showGlyphCount = this.pageGlyphCount;

            if (this.currentPage)
                for (let i = 0; i < this.currentPage.length; ++i)
                {
                    this.currentPage[i].hidden = false;
                }
        }
    }

    public moveToNextPage(): void
    {
        const nextPage = this.queuedPages.shift();
        this.setPage(nextPage);
    }

    public queueScript(script: string): void
    {
        const pages = scriptToPages(script, { font: this.font, lineWidth: 192, lineCount: 2 });
        this.queuedPages.push(...pages);
        
        if (!this.currentPage)
            this.moveToNextPage();
    }

    private applyStyle(): void
    {
        if (!this.currentPage) return;

        const current = this.getCurrentGlyph();

        if (current) {
            if (current.styles.has("delay")) {
                this.showCharTime = parseFloat(current.styles.get("delay") as string);
            } else {
                this.showCharTime = .05;
            }
        }

        this.currentPage.forEach((glyph, i) => {
            if (glyph.styles.has("r")) glyph.hidden = false;
            if (glyph.styles.has("red")) glyph.color = 0x0000FF;
            if (glyph.styles.has("shk")) 
                glyph.offset = makeVector2(randomInt(-1, 1), randomInt(-1, 1));
            if (glyph.styles.has("wvy"))
                glyph.offset.y = (Math.sin(i + this.pageTime * 5) * 3) | 0;
        });
    }

    private setPage(page: Page | undefined): void
    {
        this.currentPage = page;
        this.pageTime = 0;
        this.showGlyphCount = 0;
        this.showGlyphElapsed = 0;
        this.pageGlyphCount = page ? page.length : 0;
    }
}
