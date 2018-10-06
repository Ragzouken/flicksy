import * as http from 'http';

export function url(response: string)
{
    const gist = JSON.parse(response).gists[0];
    return 'http://gist.github.com/' + gist.repo;
};

export function postGist(content: string, callback: (url: string) => void) 
{
    const data = {
        "description": "Flicksy Project",
        "public": true,
        "files": {
            "project.json": content,
        }
    }

    const json = JSON.stringify(data);

    const options = {
        host: 'gist.github.com',
        port: 80,
        path: '/api/v3/gists',
        method: 'POST',
        headers: {
            'host': 'gist.github.com',
            'Content-length': json.length, 
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
  
    const req = http.request(options, res => 
    {
        let body = "";

        res.setEncoding('utf8');
        
        res.on('data', chunk => body += chunk);
        res.on('end', () => callback(url(body)));
    });

    req.end(json);
};
