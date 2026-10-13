package com.gaiaonline.games
{
   import com.gaiaonline.gameFramework.shell.IGameShell;
   import flash.events.IEventDispatcher;
   
   public interface IGaiaGame extends IEventDispatcher
   {
      
      function init(param1:IGameShell) : void;
   }
}

