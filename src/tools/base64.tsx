export function base64ToUint8(base64: string): Uint8ClampedArray 
{
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8ClampedArray(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) 
    {
        array[i] = raw.charCodeAt(i);
    }

    return array;
}

export function uint8ToBase64(u8Arr: Uint8ClampedArray): string
{
    var CHUNK_SIZE = 0x8000; //arbitrary number
    var index = 0;
    var length = u8Arr.length;
    var result = '';
    var slice;
    
    while (index < length) 
    {
        slice = u8Arr.subarray(index, Math.min(index + CHUNK_SIZE, length)); 
        result += String.fromCharCode.apply(null, slice);
        index += CHUNK_SIZE;
    }

    return btoa(result);
}
