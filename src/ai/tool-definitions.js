'use strict';
const toolDefinitions=[
{type:'function',function:{name:'server_overview',description:'Get server summary',parameters:{type:'object',properties:{},additionalProperties:false}}},
{type:'function',function:{name:'list_channels',description:'List server channels',parameters:{type:'object',properties:{},additionalProperties:false}}},
{type:'function',function:{name:'create_text_channel',description:'Create a text channel',parameters:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false}}},
{type:'function',function:{name:'create_role',description:'Create a role with no permissions',parameters:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false}}}
];
module.exports={toolDefinitions};
