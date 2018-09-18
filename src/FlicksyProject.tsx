
import * as uuid from 'uuid/v4';
import { DrawingBoard, DrawingBoardData } from './DrawingBoard';

export interface FlicksyProjectData
{
    guid: string;
    name: string;

    flicksyVersion: string;

    drawingBoards: DrawingBoardData[];
}

export class FlicksyProject
{
    public guid: string;
    public name: string;
    
    public flicksyVersion: string;

    public drawingBoards: DrawingBoard[];

    public toData(): FlicksyProjectData
    {
        return {
            guid: this.guid,
            name: this.name,
            flicksyVersion: this.flicksyVersion,
            drawingBoards: this.drawingBoards.map(board => board.toData()),
        };
    }
}
