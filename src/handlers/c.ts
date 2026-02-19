import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";


enum JsonType {
    INT,
    FLOAT,
    STRING,
    BOOLEAN,
    LIST,
    OBJECT,
    UNDEFINED,
    INVALID
}

export default class cHandler implements FormatHandler {
    public name: string = "c";
    public supportedFormats?: FileFormat[] = [
        {
            name: "C Source File",
            format: "c",
            extension: "c",
            mime: "text/x-c",
            from: false,
            to: true,
            internal: "c"
        },
        {
            name: "JavaScript Object Notation",
            format: "json",
            extension: "json",
            mime: "application/json",
            from: true,
            to: false,
            internal: "json"
        }
    ];

    public ready: boolean = false;
    
    async init () {
        this.ready = true;
    }

    async doConvert(
        inputFiles: FileData[],
        inputFormat: FileFormat,
        outputFormat: FileFormat
    ): Promise<FileData[]> {
        if (outputFormat.internal !== "c") {throw "Invalid output format";}
        
        let outputFiles: FileData[] = new Array<FileData>();

        for (const file of inputFiles) {
            let outputText: string = "";
            outputText += "#include <stdio.h>\n"
            outputText += "#include <stdbool.h>\n\n\n"
            outputText += "int main(int argc, char** argv) {\n"
            const structName = "jsonObject";
            let isValidJson: boolean = false;
            let bytes: Uint8Array<ArrayBufferLike> = file.bytes;
            let jsonStr: string = "";
            bytes.forEach((byte) => {
                jsonStr += String.fromCharCode(byte);
            });
            let jsonObj: Object = {};
            try {
                jsonObj = JSON.parse(jsonStr);
                isValidJson = true;
            } catch (err) {
                console.error(`${file.name} is not a valid JSON file.`);
            }

            if (isValidJson) {
                outputText += await this.createStruct(structName, jsonObj, 0);
            }

            outputText += "\n\n";
            outputText += await this.assignValues(structName, jsonObj);
            outputText += "\n";

            outputText += "\treturn 0;\n}";
            let encoder = new TextEncoder();
            bytes = new Uint8Array(encoder.encode(outputText));
            let name = file.name.split(".")[0] + "." + outputFormat.extension;

            outputFiles.push({name: name, bytes: bytes});
            //console.debug(outputFiles);

        };
        console.debug(outputFiles);
        
        return outputFiles;
    }

    async createStruct(pKey: string, pObject: Object, pRecursionLevel: number): Promise<string> {
        let result: string = "";
        let indent: string = "\t".repeat(pRecursionLevel+2);
        let isUnion: boolean = false;
        if (pRecursionLevel > 0) {
            result += "\tunion {\n";
            isUnion = true;
        } else {
            result += "\ttypedef struct {\n";
        }

        // Iterate through keys of object
        let key: keyof Object;
        for (key in pObject) {
            let val: any = pObject[key];
            let cTypeStr: string = "";
            let valType: JsonType[] = await this.getValueType(val);
            if (valType[0] !== JsonType.INVALID) {
                result += indent;
                if (isUnion) {
                    result += "\t";
                }
                if (valType[0] === JsonType.LIST) {
                    let valLength: number = val.length;
                    result += await this.jsonToCType(valType[1]) + " " + key + `[${valLength}];\n`;
                } else if (valType[0] === JsonType.OBJECT) {
                    result += await this.createStruct(key, val, pRecursionLevel+1);
                } else {
                    result += await this.jsonToCType(valType[0]) + " " + key + ";\n";
                }
            }
            cTypeStr = await this.jsonToCType(valType[0]);
        }

        result += indent + "} " + pKey + ";\n";
        return result;
    }

    async assignValues(pKey: string, pObject: Object): Promise<string> {
        let result: string = "";
        let key: keyof Object;
        for (key in pObject) {
            let val = pObject[key];
            let objType: JsonType[] = await this.getValueType(val);
            if (objType[0] !== JsonType.INVALID) {
                switch (objType[0]) {
                    case (JsonType.LIST):
                        let i = 0;
                        for (let element in val) {
                            result += `\t${pKey}.${key}[${i}] = ${element};\n`
                            i++;
                        }
                    break;
                    case (JsonType.OBJECT):
                        result += await this.assignValues(`${pKey}.${key}`, val);    
                    break;
                    case (JsonType.INT | JsonType.FLOAT | JsonType.BOOLEAN):
                        result += `\t${pKey}.${key} = ${val};\n`;    
                    break;
                    case (JsonType.STRING):
                        result += `\t${pKey}.${key} = "${val}";\n`;
                    break;
                    case (JsonType.UNDEFINED):
                        result += `\t${pKey}.${key} = (void*) (${val});\n`;
                        break;
                    default:
                        break;
                }
            }
        }
        return result;
    }

    async getValueType(pVal: any): Promise<JsonType[]> {
        let result: JsonType[] = [JsonType.INVALID];
        if ((pVal instanceof String) || (typeof pVal === "string")) {
            result = [JsonType.STRING];
        } else if ((pVal instanceof Boolean) || (typeof pVal === "boolean")) {
            result = [JsonType.BOOLEAN];
        } else if (!isNaN(Number(pVal))) {
            if (Number.isInteger(Number(pVal))) {
                result = [JsonType.INT];
            } else {
                result = [JsonType.FLOAT];
            }
        }
        else if (Array.isArray(pVal)) {
            if (pVal.length > 0) {
                if (pVal.every(item => typeof item == typeof pVal[0])) {
                    result = [JsonType.LIST, (await this.getValueType(pVal[0]))[0]];
                }
            } else {
                result = [JsonType.LIST, JsonType.UNDEFINED];
            }
        } else if ((typeof pVal === "object" ) && (pVal !== null) && !(Array.isArray(pVal))) {
            result = [JsonType.OBJECT];
        }

        return result;
    }

    async jsonToCType(pType: JsonType): Promise<string> {
        let result: string = "";
        switch (pType) {
            case JsonType.BOOLEAN:
                result = "bool";
                break;
            case JsonType.INT:
                result = "int";
                break;
            case JsonType.FLOAT:
                result = "float";
                break;
            case JsonType.STRING:
                result = "char*";
                break;
            case JsonType.UNDEFINED:
                result = "void*";
                break;
            default:
                result = "void*";
                break;
        }
        return result;
    }

}