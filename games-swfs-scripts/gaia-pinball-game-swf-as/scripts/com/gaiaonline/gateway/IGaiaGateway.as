package com.gaiaonline.gateway
{
   import flash.events.IEventDispatcher;
   
   public interface IGaiaGateway extends IEventDispatcher
   {
      
      function set timeout(param1:uint) : void;
      
      function get port() : uint;
      
      function get connected() : Boolean;
      
      function leaveChannel(param1:*) : void;
      
      function get channels() : Array;
      
      function logout() : void;
      
      function reconnect() : Boolean;
      
      function chat(param1:GaiaChatMessage) : void;
      
      function leaveAllChannels() : void;
      
      function getAllChannels() : void;
      
      function call(param1:String, ... rest) : uint;
      
      function getChannelByID(param1:*) : IGaiaChannel;
      
      function get timeout() : uint;
      
      function createChannel(param1:String, param2:Object = null, param3:String = "") : void;
      
      function get host() : String;
      
      function login(param1:String, param2:String) : void;
      
      function connect(param1:String, param2:int) : void;
      
      function getPresenceList(param1:*) : void;
      
      function callWithCallback(param1:Function, param2:String, ... rest) : uint;
      
      function getChannelByName(param1:String) : IGaiaChannel;
      
      function registerIdentityClass(param1:Class) : Boolean;
      
      function close() : void;
      
      function joinChannel(param1:*, param2:String = "") : void;
   }
}

