///<reference types="node" />

import { IncomingMessage, ServerResponse } from "http";
import { EventEmitter } from "events";

interface CreateHandlerOptions {
    secret: string;
    events?: string | string[];
    fallthrough?: boolean
}

interface handler extends EventEmitter {
    (req: IncomingMessage, res: ServerResponse, next: (err: Error) => void): void;
}

declare function createHandler(options: CreateHandlerOptions): handler;

export = createHandler;
