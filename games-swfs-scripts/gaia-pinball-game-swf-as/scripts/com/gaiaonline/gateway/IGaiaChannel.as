package com.gaiaonline.gateway
{
   public interface IGaiaChannel
   {
      
      function get name() : String;
      
      function leave() : void;
      
      function chat(param1:GaiaChatMessage) : void;
      
      function get id() : Number;
      
      function get occupancy() : uint;
      
      function getPresenceList() : void;
   }
}

