import * as http from 'http';

export var url = function (response: string)
{
    var gist = JSON.parse(response).gists[0];
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

    var options = {
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
  
    var req = http.request(options, function(res) 
    {
        var body = "";

        res.setEncoding('utf8');
        
        res.on('data', chunk => body += chunk);
        res.on('end', () => callback(url(body)));
    });

    req.end(json);
};
